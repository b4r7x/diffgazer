// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { createElement, Suspense } from "react";
import { describe, expect, it } from "vitest";
import { demoLoaders } from "@/generated/demo-loaders";
import { getConsumptionMetadata } from "@/lib/consumption-metadata";
import {
  getInstallCommand,
  LOCAL_DGADD_PREREQUISITE,
  routeSlugsFromSourcePath,
  sourceSlugsForLibrary,
} from "@/lib/library";

const repoRoot = resolve(import.meta.dirname, "../../../..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function listRepoFiles(dir: string, extension: string): string[] {
  const root = resolve(repoRoot, dir);
  const files: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(path);
      }
    }
  };

  visit(root);
  return files;
}

function readAbsolute(path: string): string {
  return readFileSync(path, "utf8");
}

function basename(file: string): string {
  return (
    file
      .replace(/\.(ts|tsx|mdx)$/, "")
      .split("/")
      .at(-1) ?? ""
  );
}

// A single referenced example, carrying the (library, item) scope it is
// resolved against at runtime. The renderer reads `data.exampleSource[name]`,
// which is built per (library, item) — only files in that item's own example
// dir (plus declared companion dirs). The guard must mirror that scope instead
// of flattening every basename into one cross-library/cross-item set.
type ExampleRef = {
  library: "ui" | "keys";
  item: string;
  name: string;
};

function exampleDirForLibrary(library: "ui" | "keys"): string {
  return library === "ui" ? "libs/ui/registry/examples" : "libs/keys/registry/examples";
}

// Component docs may merge sibling example dirs into a page's exampleSource via
// `companionExamples` (see libs/ui/scripts/build-docs-data.ts processComponent).
// Both the component doc and its matching MDX page share that scope at runtime.
function collectCompanionExamples(): Map<string, string[]> {
  const companions = new Map<string, string[]>();
  for (const file of listRepoFiles("libs/ui/registry/component-docs", ".ts")) {
    const source = readAbsolute(file);
    const block = source.match(/companionExamples:\s*\[([^\]]*)\]/);
    if (!block) continue;
    const items = [...block[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
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
      for (const match of block[1].matchAll(/name: "([a-z0-9-]+)"/g)) {
        names.add(match[1]);
      }
    }
    for (const match of source.matchAll(/example: "([a-z0-9-]+)"/g)) {
      names.add(match[1]);
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
        for (const match of block[1].matchAll(/name: "([a-z0-9-]+)"/g)) {
          refs.push({ library, item, name: match[1] });
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
      examplesBlock ? [...examplesBlock[1].matchAll(/name: "([a-z0-9-]+)"/g)].length : 0,
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

// The renderer joins a UI page to its component record via the frontmatter
// `component:` value, not the filename (route loader: loadDocData("components",
// data.component)). That record owns the exampleSource the page renders
// <Example name=...> against, so the guard must scope by the same key. Pages
// with example refs but no `component:` resolve to no record at runtime, which
// silently drops the example; surface that as an unresolvable scope so the
// guard fails loudly instead of skipping a broken page.
function frontmatterComponent(source: string): string | null {
  const block = source.match(/^---\n([\s\S]*?)\n---/);
  if (!block) return null;
  const field = block[1].match(/^component:\s*"?([a-z0-9-]+)"?\s*$/m);
  return field ? field[1] : null;
}

function collectMdxExampleRefs(): ExampleRef[] {
  const refs: ExampleRef[] = [];
  for (const file of listRepoFiles("libs/ui/docs/content", ".mdx")) {
    const source = readAbsolute(file);
    const item = frontmatterComponent(source) ?? `${basename(file)} (no component frontmatter)`;
    for (const match of source.matchAll(/<Example\s+name="([^"]+)"/g)) {
      refs.push({ library: "ui", item, name: match[1] });
    }
  }
  return refs;
}

function collectPublicDocsSources(): Array<{ path: string; source: string }> {
  const files = [
    ...listRepoFiles("libs/ui/registry/component-docs", ".ts"),
    ...listRepoFiles("libs/ui/docs/content", ".mdx"),
    ...listRepoFiles("libs/ui/docs/generated", ".json"),
    ...listRepoFiles("libs/keys/docs/hook-docs", ".ts"),
    ...listRepoFiles("libs/keys/docs/content", ".mdx"),
    ...listRepoFiles("libs/keys/docs/generated", ".json"),
    ...listRepoFiles("libs/keys/docs/generated", ".ts"),
  ];

  return files.map((file) => ({
    path: file.slice(repoRoot.length + 1),
    source: readAbsolute(file),
  }));
}

function collectInputLikeDocsSources(): Array<{
  path: string;
  source: string;
}> {
  const paths = [
    "libs/ui/registry/component-docs/input.ts",
    "libs/ui/registry/component-docs/textarea.ts",
    "libs/ui/registry/component-docs/search-input.ts",
    "libs/ui/docs/content/components/input.mdx",
    "libs/ui/docs/content/components/textarea.mdx",
    "libs/ui/docs/content/components/search-input.mdx",
    "libs/ui/docs/generated/components/input.json",
    "libs/ui/docs/generated/components/textarea.json",
    "libs/ui/docs/generated/components/search-input.json",
  ];

  return paths.map((path) => ({ path, source: readRepoFile(path) }));
}

function camelToKebab(value: string): string {
  return value.replace(
    /[A-Z]/g,
    (match, index) => `${index === 0 ? "" : "-"}${match.toLowerCase()}`,
  );
}

describe("docs-library source path mapping", () => {
  it("prefixes source slugs by library id", () => {
    expect(sourceSlugsForLibrary("ui", ["components", "button"])).toEqual([
      "ui",
      "components",
      "button",
    ]);
    expect(sourceSlugsForLibrary("keys", ["guides", "navigation"])).toEqual([
      "keys",
      "guides",
      "navigation",
    ]);
  });

  it("uses library defaults when route slugs are empty", () => {
    expect(sourceSlugsForLibrary("ui", [])).toEqual(["ui", "getting-started", "installation"]);
    expect(sourceSlugsForLibrary("keys", [])).toEqual(["keys", "getting-started", "installation"]);
  });

  it("maps source paths to route slugs only for the active library", () => {
    expect(routeSlugsFromSourcePath("ui", "/docs/ui/components/button")).toEqual([
      "components",
      "button",
    ]);
    expect(routeSlugsFromSourcePath("keys", "/docs/keys/guides/navigation")).toEqual([
      "guides",
      "navigation",
    ]);
    expect(routeSlugsFromSourcePath("ui", "/docs/keys/guides/navigation")).toBeNull();
    expect(routeSlugsFromSourcePath("keys", "/docs/ui/components/button")).toBeNull();
  });

  it("generates local install commands while packages are unpublished", () => {
    expect(getInstallCommand("ui", "button")).toBe("pnpm exec dgadd add ui/button");
    expect(getInstallCommand("ui", "ui/button")).toBe("pnpm exec dgadd add ui/button");
    expect(getInstallCommand("keys", "navigation")).toBe("pnpm exec dgadd add keys/navigation");
    expect(getInstallCommand("app", "installation")).toBeNull();
  });

  it("keeps installer handoff publish-gated and local-first", () => {
    expect(LOCAL_DGADD_PREREQUISITE).toContain("locally packed @diffgazer/add tarball");
    expect(LOCAL_DGADD_PREREQUISITE).toContain("pnpm exec dgadd");
    expect(LOCAL_DGADD_PREREQUISITE).not.toContain("npx @diffgazer/add");
  });

  it("maps UI utility consumption metadata to lib paths", () => {
    const meta = getConsumptionMetadata("ui", "compose-refs", "lib");

    expect(meta.packageImport).toBe("@diffgazer/ui/lib/compose-refs");
    expect(meta.copyPath).toBe("src/lib/compose-refs.ts");
    expect(meta.dgaddName).toBe("ui/compose-refs");
    expect(meta.paths.copy.available).toBe(false);
    expect(meta.paths.copy.note).toContain("r.b4r7.dev does not resolve");
    expect(meta.paths.dgadd.command).toBe("pnpm exec dgadd add ui/compose-refs");
    expect(meta.paths.dgadd.note).toContain("tarball");
    expect(meta.paths.package.available).toBe(false);
  });

  it("maps prefixed keys hook docs to registry ids without double use prefixes", () => {
    const meta = getConsumptionMetadata("keys", "use-navigation", "hook");

    expect(meta.copyPath).toBe("src/hooks/use-navigation.ts");
    expect(meta.dgaddName).toBe("keys/navigation");
    expect(meta.paths.copy.available).toBe(false);
    expect(meta.paths.copy.note).toContain("r.b4r7.dev does not resolve");
    expect(meta.paths.dgadd.command).toBe("pnpm exec dgadd add keys/navigation");
    expect(meta.paths.dgadd.note).toContain("tarball");
  });

  it("marks provider-backed keys hooks as package-only while keeping package import metadata", () => {
    const meta = getConsumptionMetadata("keys", "use-action-row-navigation", "hook");

    expect(meta.copyPath).toBe("src/hooks/use-action-row-navigation.ts");
    expect(meta.packageImport).toBe("@diffgazer/keys");
    expect(meta.paths.copy.available).toBe(false);
    expect(meta.paths.dgadd.available).toBe(false);
    expect(meta.paths.package.available).toBe(false);
    expect(meta.paths.package.note).toContain("not live yet");
  });

  it("uses deterministic docs preview without npx network dependency", () => {
    const docsPackage = JSON.parse(readRepoFile("apps/docs/package.json"));

    expect(docsPackage.scripts.preview).toBe("vite preview --outDir .output/public");
    expect(docsPackage.scripts.preview).not.toContain("npx");
  });

  it("documents the exact React peer floor for public docs handoff", () => {
    const docs = [
      readRepoFile("libs/ui/README.md"),
      readRepoFile("libs/keys/README.md"),
      readRepoFile("cli/add/README.md"),
      readRepoFile("PACKAGE_GOVERNANCE.md"),
      readRepoFile("libs/ui/docs/content/getting-started/typescript.mdx"),
      readRepoFile("libs/ui/docs/content/getting-started/consumption-modes.mdx"),
      readRepoFile("libs/keys/docs/content/getting-started/index.mdx"),
      readRepoFile("libs/keys/docs/content/api/index.mdx"),
    ].join("\n");

    expect(docs).toContain("React `>=19.2.0`");
    expect(docs).not.toMatch(/React 19(?!\.2|`)/);
    expect(docs).not.toContain("React 19+");
    expect(docs).not.toContain("React 19.2+");
  });

  it("fails static validation when component, hook docs, or pages reference missing examples", () => {
    const referenced = [
      ...collectExampleRefsFromComponentDocs(),
      ...collectExampleRefsFromHookDocs(),
      ...collectMdxExampleRefs(),
    ];
    // A reference is "missing" exactly when the renderer would throw
    // "Missing <library> docs example source: <name>": the name is absent
    // from the (library, item) example dir (and its companion dirs) that
    // builds the page's exampleSource. Report item + name so a failure
    // points at the exact broken reference instead of a bare basename.
    const missing = referenced
      .filter((ref) => !exampleExists(ref.library, ref.item, ref.name))
      .map((ref) => `${ref.library}/${ref.item}: ${ref.name}`);

    expect(missing).toEqual([]);
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

  it("keeps public docs off removed API aliases", () => {
    const globalForbidden = [/\bonValueChange\b/, /\bonSelectedIdChange\b/, /\bhighlightedId\b/];
    const checkboxRadioForbidden = [/\bonCheckedChange\b/];

    for (const { path, source } of collectPublicDocsSources()) {
      for (const pattern of globalForbidden) {
        expect(source, path).not.toMatch(pattern);
      }
      if (/\b(checkbox|radio)\b/i.test(path) && !/\bmenu\b/i.test(path)) {
        for (const pattern of checkboxRadioForbidden) {
          expect(source, path).not.toMatch(pattern);
        }
      }
    }
  });

  it("documents input-like invalid state through aria-invalid", () => {
    const forbidden = [
      /\berror=\{?true\}?/,
      /\berror prop\b/i,
      /\bpass error\b/i,
      /\bsetting error\b/i,
    ];

    const sources = collectInputLikeDocsSources();

    for (const { path, source } of sources) {
      for (const pattern of forbidden) {
        expect(source, path).not.toMatch(pattern);
      }
    }
    expect(sources.map(({ source }) => source).join("\n")).toContain("aria-invalid");
  });

  it("loads synced keys demos through the generated demo loader", async () => {
    const keysLoader = demoLoaders.keys;
    expect(keysLoader).toBeTypeOf("function");

    const { demos } = await keysLoader();
    const Demo = demos["use-navigation-basic"];
    expect(Demo).toBeDefined();
    if (!Demo) throw new Error("Missing keys demo: use-navigation-basic");

    render(createElement(Suspense, { fallback: "loading" }, createElement(Demo)));

    expect(await screen.findByRole("listbox", { name: "Fruits" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Apple" })).toBeTruthy();
  });

  it("keeps public docs on current highlight and keyboard prop names", () => {
    const docs = [
      readRepoFile("libs/ui/registry/component-docs/menu.ts"),
      readRepoFile("libs/ui/registry/component-docs/navigation-list.ts"),
      readRepoFile("libs/ui/registry/component-docs/select.ts"),
      readRepoFile("libs/ui/registry/component-docs/checkbox.ts"),
      readRepoFile("libs/ui/docs/content/patterns/keyboard-navigation.mdx"),
      readRepoFile("libs/ui/docs/content/patterns/compound-components.mdx"),
      readRepoFile("libs/ui/docs/content/components/checkbox.mdx"),
      readRepoFile("libs/ui/docs/content/components/select.mdx"),
    ].join("\n");

    expect(docs).not.toMatch(/\bNavigationList\b[\s\S]{0,160}\bisHighlighted\b/);
    expect(docs).not.toContain("isFocused");
    expect(docs).not.toContain("onHighlight props");
    expect(docs).not.toMatch(/headless (focus|keyboard)/);
    expect(docs).not.toContain("highlightedId");
    expect(docs).toContain("highlighted");
    expect(docs).toContain("onHighlightChange");
    expect(docs).toContain("focused");
    expect(docs).toContain("built-in arrow navigation");
  });

  it("keeps public composition docs from promising opaque wrapper depth", () => {
    const docs = [
      readRepoFile("libs/ui/docs/content/patterns/compound-components.mdx"),
      ...listRepoFiles("libs/ui/registry/component-docs", ".ts").map(readAbsolute),
    ].join("\n");

    expect(docs).not.toMatch(/no matter how deep|arbitrarily nested|deeply nested/i);
    expect(docs).toContain("opaque wrapper");
    expect(docs).toContain("direct StepperContent child");
  });

  it("keeps public install snippets local-first or publish-gated", () => {
    const docs = [
      "libs/ui/README.md",
      "libs/keys/README.md",
      "cli/add/README.md",
      "cli/diffgazer/README.md",
      ...listRepoFiles("libs/ui/docs/content", ".mdx").map((file) =>
        file.slice(repoRoot.length + 1),
      ),
    ];

    for (const path of docs) {
      const source = readRepoFile(path);
      if (
        !/(npx @diffgazer\/add|pnpm dlx @diffgazer\/add|yarn dlx @diffgazer\/add|bunx @diffgazer\/add|npm install @diffgazer\/|npm install -g diffgazer)/.test(
          source,
        )
      ) {
        continue;
      }

      expect(source, path).toMatch(
        /npm view|publish-gated|After Publication|after publication|after `@diffgazer\/add` is published|after its npm package is published/,
      );
    }
  });

  it("every public UI component/hook page has consumption metadata block", () => {
    const componentPages = listRepoFiles("libs/ui/docs/content/components", ".mdx");
    const hookPages = listRepoFiles("libs/ui/docs/content/hooks", ".mdx");

    for (const file of [...componentPages, ...hookPages]) {
      if (file.endsWith("/index.mdx")) continue;
      const source = readAbsolute(file);
      const relPath = file.slice(repoRoot.length + 1);
      expect(
        source.includes("<ConsumptionBlock"),
        `${relPath} must include <ConsumptionBlock />`,
      ).toBe(true);
    }
  });

  it("every public keys hook page has consumption metadata block", () => {
    const hookPages = listRepoFiles("libs/keys/docs/content/hooks", ".mdx");

    for (const file of hookPages) {
      if (file.endsWith("/index.mdx")) continue;
      const source = readAbsolute(file);
      const relPath = file.slice(repoRoot.length + 1);
      expect(
        source.includes("<ConsumptionBlock"),
        `${relPath} must include <ConsumptionBlock />`,
      ).toBe(true);
    }
  });

  it("documents every exported keys hook under hook handoff pages", () => {
    const indexSource = readRepoFile("libs/keys/src/index.ts");
    const exportedHookSlugs = [
      ...indexSource.matchAll(/export \{ (use[A-Z]\w+) \} from "\.\/hooks\//g),
    ]
      .map((match) => camelToKebab(match[1]))
      .sort();
    const documentedHookSlugs = listRepoFiles("libs/keys/docs/content/hooks", ".mdx")
      .map((file) =>
        file
          .replace(/\.mdx$/, "")
          .split("/")
          .at(-1),
      )
      .filter((slug): slug is string => typeof slug === "string" && slug !== "index")
      .sort();

    expect(documentedHookSlugs).toEqual(exportedHookSlugs);
  });

  it("does not render empty API Reference headings in component pages", () => {
    const componentPages = listRepoFiles("libs/ui/docs/content/components", ".mdx");

    for (const file of componentPages) {
      const source = readAbsolute(file);
      const relPath = file.slice(repoRoot.length + 1);

      if (source.includes("## API Reference")) {
        expect(
          source,
          `${relPath} has standalone ## API Reference heading -- use <APIReference /> instead`,
        ).not.toMatch(/## API Reference\s*\n\s*\n\s*<PropsTable/);
      }
    }
  });

  it("docs-libraries.json does not point enabled libraries to missing content", () => {
    const config = JSON.parse(readRepoFile("apps/docs/config/docs-libraries.json"));
    const enabledLibraries = config.libraries.filter((lib: { enabled: boolean }) => lib.enabled);

    for (const lib of enabledLibraries) {
      const contentDir = `apps/docs/content/docs/${lib.id}`;
      const contentDirFull = resolve(repoRoot, contentDir);
      let hasContent = false;
      try {
        const entries = readdirSync(contentDirFull);
        hasContent = entries.length > 0;
      } catch {
        hasContent = false;
      }
      expect(hasContent, `enabled library "${lib.id}" has no content in ${contentDir}`).toBe(true);
    }
  });

  it("READMEs show consumption path matrix for both libraries", () => {
    const rootReadme = readRepoFile("README.md");
    const uiReadme = readRepoFile("libs/ui/README.md");
    const keysReadme = readRepoFile("libs/keys/README.md");
    const cliReadme = readRepoFile("cli/add/README.md");

    expect(rootReadme).toContain("Manual copy");
    expect(rootReadme).toContain("dgadd");
    expect(rootReadme).toContain("npm package");

    expect(uiReadme).toContain("Manual copy");
    expect(uiReadme).toContain("dgadd");
    expect(uiReadme).toContain("npm package");

    expect(keysReadme).toContain("Manual copy");
    expect(keysReadme).toContain("dgadd");
    expect(keysReadme).toContain("npm package");

    expect(cliReadme).toContain("@diffgazer/ui");
    expect(cliReadme).toContain("@diffgazer/keys");

    for (const readme of [rootReadme, uiReadme, keysReadme, cliReadme]) {
      expect(readme).toMatch(/publish-gated/);
    }
  });
});
