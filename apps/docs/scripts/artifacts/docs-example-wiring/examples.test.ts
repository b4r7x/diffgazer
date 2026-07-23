import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { createElement, Suspense } from "react";
import { describe, expect, it } from "vitest";
import { demoLoaders } from "@/generated/demo-loaders";
import { basename, listRepoFiles, readAbsolute, repoRoot } from "./repo-files.js";

type ExampleRef = {
  library: "ui" | "keys";
  item: string;
  name: string;
};

type DocsLibrary = "ui" | "keys";
type GeneratedDataType = "components" | "hooks";

type FrontmatterDataRef = {
  path: string;
  library: DocsLibrary;
  type: GeneratedDataType;
  name: string;
};

type ScaffoldHeroRef = {
  path: string;
  library: DocsLibrary;
  component: string | null;
  hero: string;
};

const DOCS_MDX_DIRS: Array<{ dir: string; library: DocsLibrary }> = [
  { dir: "libs/ui/docs/content", library: "ui" },
  { dir: "libs/keys/docs/content", library: "keys" },
  { dir: "apps/docs/content/docs/ui", library: "ui" },
  { dir: "apps/docs/content/docs/keys", library: "keys" },
];

function exampleDirForLibrary(library: "ui" | "keys"): string {
  return library === "ui" ? "libs/ui/registry/examples" : "libs/keys/registry/examples";
}

function collectCompanionExamples(): Map<string, string[]> {
  const companions = new Map<string, string[]>();
  for (const file of listRepoFiles("libs/ui/registry/component-docs", ".ts")) {
    const source = readAbsolute(file);
    const block = source.match(/companionExamples:\s*\[([^\]]*)\]/);
    if (!block?.[1]) continue;
    const items = [...block[1].matchAll(/"([a-z0-9-]+)"/g)]
      .map((m) => m[1])
      .filter((value): value is string => Boolean(value));
    if (items.length > 0) companions.set(basename(file), items);
  }
  return companions;
}

const COMPANION_EXAMPLES = collectCompanionExamples();

function exampleExists(library: "ui" | "keys", item: string, name: string): boolean {
  const dir = exampleDirForLibrary(library);
  const scopes = [item, ...(COMPANION_EXAMPLES.get(item) ?? [])];
  return scopes.some((scope) => existsSync(resolve(repoRoot, dir, scope, `${name}.tsx`)));
}

function collectExampleRefsFromComponentDocs(): ExampleRef[] {
  const refs: ExampleRef[] = [];
  for (const file of listRepoFiles("libs/ui/registry/component-docs", ".ts")) {
    const item = basename(file);
    const source = readAbsolute(file);
    const names = new Set<string>();
    for (const block of source.matchAll(/examples:\s*\[([\s\S]*?)\]/g)) {
      for (const match of (block[1] ?? "").matchAll(/name: "([a-z0-9-]+)"/g)) {
        if (match[1]) names.add(match[1]);
      }
    }
    for (const match of source.matchAll(/example: "([a-z0-9-]+)"/g)) {
      if (match[1]) names.add(match[1]);
    }
    for (const name of names) {
      refs.push({ library: "ui", item, name });
    }
  }
  return refs;
}

const HOOK_DOC_DIRS: Array<{ dir: string; library: "ui" | "keys" }> = [
  { dir: "libs/ui/registry/hook-docs", library: "ui" },
  { dir: "libs/keys/docs/hook-docs", library: "keys" },
];

function listHookDocFiles(): string[] {
  return HOOK_DOC_DIRS.flatMap(({ dir }) => listRepoFiles(dir, ".ts"));
}

function collectExampleRefsFromHookDocs(): ExampleRef[] {
  const refs: ExampleRef[] = [];
  for (const { dir, library } of HOOK_DOC_DIRS) {
    for (const file of listRepoFiles(dir, ".ts")) {
      const item = basename(file);
      const source = readAbsolute(file);
      for (const block of source.matchAll(/examples:\s*\[([\s\S]*?)\]/g)) {
        for (const match of (block[1] ?? "").matchAll(/name: "([a-z0-9-]+)"/g)) {
          if (match[1]) refs.push({ library, item, name: match[1] });
        }
      }
    }
  }
  return refs;
}

function collectHookDocExampleCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of listHookDocFiles()) {
    const hook = file.replace(/\.ts$/, "").split("/").at(-1);
    if (!hook) continue;

    const source = readAbsolute(file);
    const examplesBlock = source.match(/examples:\s*\[([\s\S]*?)\]/);
    counts.set(
      hook,
      examplesBlock ? [...(examplesBlock[1] ?? "").matchAll(/name: "([a-z0-9-]+)"/g)].length : 0,
    );
  }
  return counts;
}

const HOOK_PAGE_DIRS = ["libs/ui/docs/content/hooks", "libs/keys/docs/content/hooks"];

function collectHookPagesWithExamplesSection(): string[] {
  return HOOK_PAGE_DIRS.flatMap((dir) => listRepoFiles(dir, ".mdx"))
    .filter((file) => readAbsolute(file).includes("<Examples />"))
    .map((file) =>
      file
        .replace(/\.mdx$/, "")
        .split("/")
        .at(-1),
    )
    .filter((hook): hook is string => typeof hook === "string");
}

function frontmatterField(source: string, field: "component" | "hook"): string | null {
  const block = source.match(/^---\n([\s\S]*?)\n---/);
  if (!block?.[1]) return null;
  const match = block[1].match(new RegExp(`^${field}:\\s*"?([a-z0-9-]+)"?\\s*$`, "m"));
  return match?.[1] ?? null;
}

function frontmatterComponent(source: string): string | null {
  return frontmatterField(source, "component");
}

function collectMdxExampleRefs(): ExampleRef[] {
  const refs: ExampleRef[] = [];
  for (const file of listRepoFiles("libs/ui/docs/content", ".mdx")) {
    const source = readAbsolute(file);
    const item = frontmatterComponent(source) ?? `${basename(file)} (no component frontmatter)`;
    for (const match of source.matchAll(/<Example\s+name="([^"]+)"/g)) {
      if (match[1]) refs.push({ library: "ui", item, name: match[1] });
    }
  }
  return refs;
}

function collectMdxGeneratedDataRefs(): FrontmatterDataRef[] {
  const refs: FrontmatterDataRef[] = [];
  for (const { dir, library } of DOCS_MDX_DIRS) {
    for (const file of listRepoFiles(dir, ".mdx")) {
      const source = readAbsolute(file);
      const path = file.slice(repoRoot.length + 1);
      const component = frontmatterField(source, "component");
      const hook = frontmatterField(source, "hook");

      if (component) refs.push({ path, library, type: "components", name: component });
      if (hook) refs.push({ path, library, type: "hooks", name: hook });
    }
  }
  return refs;
}

function collectScaffoldHeroRefs(): ScaffoldHeroRef[] {
  const refs: ScaffoldHeroRef[] = [];
  for (const { dir, library } of DOCS_MDX_DIRS) {
    for (const file of listRepoFiles(dir, ".mdx")) {
      const source = readAbsolute(file);
      const path = file.slice(repoRoot.length + 1);
      const component = frontmatterComponent(source);

      for (const match of source.matchAll(/^\s*<ComponentDocScaffold\b[^\n>]*\bhero="([^"]+)"/gm)) {
        if (match[1]) refs.push({ path, library, component, hero: match[1] });
      }
    }
  }
  return refs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonObject(path: string): Record<string, unknown> | null {
  const value: unknown = JSON.parse(readAbsolute(path));
  return isRecord(value) ? value : null;
}

function generatedDataPath(ref: FrontmatterDataRef): string {
  return resolve(repoRoot, "apps/docs/src/generated", ref.library, ref.type, `${ref.name}.json`);
}

function readGeneratedData(ref: FrontmatterDataRef): Record<string, unknown> | null {
  const path = generatedDataPath(ref);
  if (!existsSync(path)) return null;
  return readJsonObject(path);
}

function generatedDataMatchesFrontmatter(ref: FrontmatterDataRef): boolean {
  return readGeneratedData(ref)?.name === ref.name;
}

function formatFrontmatterDataRef(ref: FrontmatterDataRef): string {
  return `${ref.path}: ${ref.library}/${ref.type}/${ref.name}`;
}

function scaffoldHeroExists(ref: ScaffoldHeroRef): boolean {
  if (!ref.component) return false;
  const data = readGeneratedData({
    path: ref.path,
    library: ref.library,
    type: "components",
    name: ref.component,
  });
  const exampleSource = data?.exampleSource;
  return isRecord(exampleSource) && ref.hero in exampleSource;
}

function formatScaffoldHeroRef(ref: ScaffoldHeroRef): string {
  const component = ref.component ?? "(missing component frontmatter)";
  return `${ref.path}: ${component} hero=${ref.hero}`;
}

describe("docs example wiring — examples", () => {
  it("fails static validation when component, hook docs, or pages reference missing examples", () => {
    const referenced = [
      ...collectExampleRefsFromComponentDocs(),
      ...collectExampleRefsFromHookDocs(),
      ...collectMdxExampleRefs(),
    ];
    const missing = referenced
      .filter((ref) => !exampleExists(ref.library, ref.item, ref.name))
      .map((ref) => `${ref.library}/${ref.item}: ${ref.name}`);

    expect(missing).toEqual([]);
  });

  it("validates frontmatter -> generated data join and hero refs", () => {
    const missingData = collectMdxGeneratedDataRefs()
      .filter((ref) => !generatedDataMatchesFrontmatter(ref))
      .map(formatFrontmatterDataRef);
    const missingHeroes = collectScaffoldHeroRefs()
      .filter((ref) => !scaffoldHeroExists(ref))
      .map(formatScaffoldHeroRef);

    expect(missingData).toEqual([]);
    expect(missingHeroes).toEqual([]);
  });

  it("requires hook pages with example sections to declare source examples", () => {
    const counts = collectHookDocExampleCounts();
    const missing = collectHookPagesWithExamplesSection().filter(
      (hook) => (counts.get(hook) ?? 0) === 0,
    );

    expect(missing).toEqual([]);
  });

  it("keeps public examples off deprecated value-change props", () => {
    const exampleSources = listRepoFiles("libs/ui/registry/examples", ".tsx")
      .map((file) => readAbsolute(file))
      .join("\n");

    expect(exampleSources).not.toMatch(/<CommandPalette\b[^>]*\bselectedId=/);
    expect(exampleSources).not.toContain("onSelectedIdChange=");
    expect(exampleSources).not.toContain("onValueChange=");
    expect(exampleSources).not.toMatch(/<Checkbox\b[^>]*\bonCheckedChange=/);
    expect(exampleSources).not.toMatch(/<Radio\b[^>]*\bonCheckedChange=/);
  });

  it("loads synced keys demos through the generated demo loader", async () => {
    const keysLoader = demoLoaders.keys;
    expect(keysLoader).toBeTypeOf("function");
    if (!keysLoader) throw new Error("Missing keys demo loader");

    const { demos } = await keysLoader();
    const Demo = demos["use-navigation-basic"];
    expect(Demo).toBeDefined();
    if (!Demo) throw new Error("Missing keys demo: use-navigation-basic");

    render(createElement(Suspense, { fallback: "loading" }, createElement(Demo)));

    expect(await screen.findByRole("listbox", { name: "Fruits" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Apple" })).toBeTruthy();
  });
});
