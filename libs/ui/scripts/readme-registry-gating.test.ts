import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

const HOSTED_REGISTRY_HOST = "r.b4r7.dev";
const GATE_PHRASE = /future|not yet live|gated/i;
// Host references that are not runnable install commands: the prose explaining
// the host is not live and the line linking to the governance status doc.
// They cannot be copy-pasted into a shell, so they are exempt from the gate.
const ALLOWED_HOST_LINE = /hosted registry at|Hosted Registry Status/i;

// Handoff surfaces that advertise the hosted registry. Every runnable
// r.b4r7.dev reference on these pages must sit under a future/gated marker so a
// consumer cannot copy a command against the DNS-dead host.
const GATED_SURFACES = ["README.md", "docs/content/utils/shadcn-namespace.mdx"] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

function packageExports(): Record<string, unknown> {
  const manifest = JSON.parse(read("package.json")) as { exports?: Record<string, unknown> };
  return manifest.exports ?? {};
}

function packageManifest(): {
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
} {
  return JSON.parse(read("package.json"));
}

function registryItem(name: string): {
  dependencies?: string[];
  files?: Array<{ path: string }>;
} {
  const registry = JSON.parse(read("registry/registry.json")) as {
    items: Array<{
      name: string;
      dependencies?: string[];
      files?: Array<{ path: string }>;
    }>;
  };
  const item = registry.items.find((candidate) => candidate.name === name);
  expect(item, `missing registry item ${name}`).toBeDefined();
  return item ?? {};
}

function sectionIsGated(lines: string[], index: number): boolean {
  let sectionStart = index;
  while (sectionStart > 0 && !lines[sectionStart]?.startsWith("#")) {
    sectionStart--;
  }
  return lines.slice(sectionStart, index + 1).some((line) => GATE_PHRASE.test(line));
}

function ungatedHostReferences(source: string): string[] {
  const lines = source.split("\n");
  const offending: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.includes(HOSTED_REGISTRY_HOST)) continue;
    if (ALLOWED_HOST_LINE.test(line)) continue;
    if (!sectionIsGated(lines, i)) {
      offending.push(`line ${i + 1}: ${line.trim()}`);
    }
  }
  return offending;
}

// Runnable one-shot commands that fetch the unpublished @diffgazer/add package
// (pnpm dlx / npx / bunx / yarn dlx). Prose mentions in backticks are exempt;
// only fenced shell commands are copy-pasted into a terminal.
const RUNNABLE_ADD_COMMAND = /\b(?:dlx|npx|bunx)\b[^\n]*@diffgazer\/add/;

function ungatedAddCommands(source: string): string[] {
  const lines = source.split("\n");
  const offending: string[] = [];
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line?.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock || !line || !RUNNABLE_ADD_COMMAND.test(line)) continue;
    if (!sectionIsGated(lines, i)) {
      offending.push(`line ${i + 1}: ${line.trim()}`);
    }
  }
  return offending;
}

describe("hosted-registry gating", () => {
  it.each(
    GATED_SURFACES,
  )("keeps every runnable hosted-registry reference in %s under a future/gated marker", (surface) => {
    const offending = ungatedHostReferences(read(surface));
    expect(
      offending,
      `ungated hosted-registry references in ${surface}:\n${offending.join("\n")}`,
    ).toEqual([]);
  });

  it("README points consumers at a currently-available install path", () => {
    const readme = read("README.md");
    expect(readme).toContain("pnpm exec dgadd add ui/button");
    expect(readme).toMatch(/Until then/);
  });

  it("maps lowlight guidance to the exported highlight entry and its caller-owned dependency", () => {
    const readme = read("README.md");
    const baseEntry = "./components/code-block";
    const highlightEntry = `${baseEntry}/highlight`;
    const manifest = packageManifest();
    const highlightItem = registryItem("code-block-highlight");

    expect(readme).toContain(`| \`lowlight\` | \`${highlightEntry}\` (caller-created instance) |`);
    expect(readme).toContain(`The base \`${baseEntry}\` entry does not need \`lowlight\`.`);
    expect(Object.hasOwn(packageExports(), highlightEntry)).toBe(true);
    expect(manifest.peerDependencies?.lowlight).toBeDefined();
    expect(manifest.peerDependenciesMeta?.lowlight?.optional).toBe(true);
    expect(highlightItem.dependencies).toContain("lowlight");
    expect(highlightItem.files?.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "registry/ui/code-block/code-block-highlight.tsx",
        "registry/ui/code-block/highlight.ts",
      ]),
    );

    const baseSource = read("registry/ui/code-block/index.ts");
    const highlightSource = read("registry/ui/code-block/code-block-highlight.tsx");
    const highlightedExample = read("registry/examples/code-block/code-block-highlighted.tsx");
    expect(baseSource).not.toContain('from "lowlight"');
    expect(baseSource).not.toContain('import("lowlight")');
    expect(highlightSource).not.toContain('from "lowlight"');
    expect(highlightSource).not.toContain('import("lowlight")');
    expect(highlightSource).toContain("lowlight: LowlightInstance");
    expect(highlightedExample).toContain('from "lowlight"');
  });

  it("root README requires the tarball pack-and-install prerequisite before the first dgadd command", () => {
    const readme = read("../../README.md");
    const sectionStart = readme.indexOf("### Copy-first mode");
    expect(sectionStart, "root README is missing the Copy-first mode section").toBeGreaterThan(-1);
    const sectionEnd = readme.indexOf("\n#", sectionStart + 1);
    const section = readme.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd);

    const packIndex = section.indexOf("pnpm --filter @diffgazer/add pack");
    const tarballIndex = section.search(/pnpm add -D \S*diffgazer-add-\*\.tgz/);
    const dgaddIndex = section.indexOf("pnpm exec dgadd");

    expect(
      packIndex,
      "Copy-first mode must pack @diffgazer/add before running dgadd",
    ).toBeGreaterThan(-1);
    expect(
      tarballIndex,
      "Copy-first mode must install the packed tarball before running dgadd",
    ).toBeGreaterThan(-1);
    expect(dgaddIndex, "Copy-first mode must run pnpm exec dgadd").toBeGreaterThan(-1);
    expect(packIndex).toBeLessThan(dgaddIndex);
    expect(tarballIndex).toBeLessThan(dgaddIndex);
  });

  it("shadcn namespace docs point consumers at a currently-available install path", () => {
    const doc = read("docs/content/utils/shadcn-namespace.mdx");
    expect(doc).toContain("pnpm exec dgadd add ui/button");
    expect(doc).toMatch(/Until then/);
  });

  it("installation docs lead the Install section with a currently-available path", () => {
    const doc = read("docs/content/getting-started/installation.mdx");
    const installStart = doc.indexOf("## Install");
    const installSection = doc.slice(installStart, doc.indexOf("\n## ", installStart + 1));
    const firstCommandBlock = installSection.match(/```(?:\w+)?\n([\s\S]*?)```/)?.[1];
    expect(
      firstCommandBlock,
      "Install section must lead with a fenced shell command block",
    ).toBeDefined();
    expect(firstCommandBlock).toContain("pnpm exec dgadd");
    expect(firstCommandBlock).not.toContain("@diffgazer/add");
  });

  it("keeps every runnable @diffgazer/add command in installation docs under a future/gated marker", () => {
    const doc = read("docs/content/getting-started/installation.mdx");
    const offending = ungatedAddCommands(doc);
    expect(
      offending,
      `ungated @diffgazer/add commands in installation.mdx:\n${offending.join("\n")}`,
    ).toEqual([]);
  });
});
