import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  getInstallCommand,
  LOCAL_DGADD_PREREQUISITE,
  routeSlugsFromSourcePath,
  sourceSlugsForLibrary,
} from "@/lib/docs-library"

const repoRoot = resolve(import.meta.dirname, "../../../..")

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

function listRepoFiles(dir: string, extension: string): string[] {
  const root = resolve(repoRoot, dir)
  const files: string[] = []
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        visit(path)
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(path)
      }
    }
  }

  visit(root)
  return files
}

function readAbsolute(path: string): string {
  return readFileSync(path, "utf8")
}

function collectExampleNamesFromComponentDocs(): Set<string> {
  const names = new Set<string>()
  for (const file of listRepoFiles("libs/ui/registry/component-docs", ".ts")) {
    const source = readAbsolute(file)
    for (const block of source.matchAll(/examples:\s*\[([\s\S]*?)\]/g)) {
      for (const match of block[1].matchAll(/name: "([a-z0-9-]+)"/g)) {
        names.add(match[1])
      }
    }
    for (const match of source.matchAll(/example: "([a-z0-9-]+)"/g)) {
      names.add(match[1])
    }
  }
  return names
}

function collectExampleNamesFromHookDocs(): Set<string> {
  const names = new Set<string>()
  for (const file of listRepoFiles("libs/ui/registry/hook-docs", ".ts")) {
    const source = readAbsolute(file)
    for (const block of source.matchAll(/examples:\s*\[([\s\S]*?)\]/g)) {
      for (const match of block[1].matchAll(/name: "([a-z0-9-]+)"/g)) {
        names.add(match[1])
      }
    }
  }
  return names
}

function collectHookDocExampleCounts(): Map<string, number> {
  const counts = new Map<string, number>()
  for (const file of listRepoFiles("libs/ui/registry/hook-docs", ".ts")) {
    const hook = file.replace(/\.ts$/, "").split("/").at(-1)
    if (!hook) continue

    const source = readAbsolute(file)
    const examplesBlock = source.match(/examples:\s*\[([\s\S]*?)\]/)
    counts.set(hook, examplesBlock ? [...examplesBlock[1].matchAll(/name: "([a-z0-9-]+)"/g)].length : 0)
  }
  return counts
}

function collectHookPagesWithExamplesSection(): string[] {
  return listRepoFiles("libs/ui/docs/content/hooks", ".mdx")
    .filter((file) => readAbsolute(file).includes("<Examples />"))
    .map((file) => file.replace(/\.mdx$/, "").split("/").at(-1))
    .filter((hook): hook is string => typeof hook === "string")
}

function collectMdxExampleNames(): Set<string> {
  const names = new Set<string>()
  for (const file of listRepoFiles("libs/ui/docs/content", ".mdx")) {
    const source = readAbsolute(file)
    for (const match of source.matchAll(/<Example\s+name="([^"]+)"/g)) {
      names.add(match[1])
    }
  }
  return names
}

function collectExampleFileNames(): Set<string> {
  return new Set(
    listRepoFiles("libs/ui/registry/examples", ".tsx").map((file) =>
      file.replace(/\.tsx$/, "").split("/").at(-1) ?? "",
    ),
  )
}

describe("docs-library source path mapping", () => {
  it("prefixes source slugs by library id", () => {
    expect(sourceSlugsForLibrary("ui", ["components", "button"])).toEqual([
      "ui",
      "components",
      "button",
    ])
    expect(sourceSlugsForLibrary("keys", ["guides", "navigation"])).toEqual([
      "keys",
      "guides",
      "navigation",
    ])
  })

  it("uses library defaults when route slugs are empty", () => {
    expect(sourceSlugsForLibrary("ui", [])).toEqual([
      "ui",
      "getting-started",
      "installation",
    ])
    expect(sourceSlugsForLibrary("keys", [])).toEqual([
      "keys",
      "getting-started",
      "installation",
    ])
  })

  it("maps source paths to route slugs only for the active library", () => {
    expect(routeSlugsFromSourcePath("ui", "/docs/ui/components/button")).toEqual([
      "components",
      "button",
    ])
    expect(routeSlugsFromSourcePath("keys", "/docs/keys/guides/navigation")).toEqual([
      "guides",
      "navigation",
    ])
    expect(routeSlugsFromSourcePath("ui", "/docs/keys/guides/navigation")).toBeNull()
    expect(routeSlugsFromSourcePath("keys", "/docs/ui/components/button")).toBeNull()
  })

  it("generates local install commands while packages are unpublished", () => {
    expect(getInstallCommand("ui", "button")).toBe("pnpm exec dgadd add ui/button")
    expect(getInstallCommand("ui", "ui/button")).toBe("pnpm exec dgadd add ui/button")
    expect(getInstallCommand("keys", "navigation")).toBe("pnpm exec dgadd add keys/navigation")
    expect(getInstallCommand("diffgazer", "getting-started")).toBeNull()
  })

  it("keeps installer handoff publish-gated and local-first", () => {
    expect(LOCAL_DGADD_PREREQUISITE).toContain("locally packed @diffgazer/add tarball")
    expect(LOCAL_DGADD_PREREQUISITE).toContain("pnpm exec dgadd")
    expect(LOCAL_DGADD_PREREQUISITE).not.toContain("npx @diffgazer/add")
  })

  it("uses deterministic docs preview without npx network dependency", () => {
    const docsPackage = JSON.parse(readRepoFile("apps/docs/package.json"))

    expect(docsPackage.scripts.preview).toBe("vite preview --outDir .output/public")
    expect(docsPackage.scripts.preview).not.toContain("npx")
  })

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
    ].join("\n")

    expect(docs).toContain("React `>=19.2.0`")
    expect(docs).not.toMatch(/React 19(?!\.2|`)/)
    expect(docs).not.toContain("React 19+")
    expect(docs).not.toContain("React 19.2+")
  })

  it("fails static validation when component, hook docs, or pages reference missing examples", () => {
    const referenced = new Set([
      ...collectExampleNamesFromComponentDocs(),
      ...collectExampleNamesFromHookDocs(),
      ...collectMdxExampleNames(),
    ])
    const available = collectExampleFileNames()
    const missing = [...referenced].filter((name) => !available.has(name))

    expect(missing).toEqual([])
  })

  it("requires hook pages with example sections to declare source examples", () => {
    const counts = collectHookDocExampleCounts()
    const missing = collectHookPagesWithExamplesSection().filter((hook) => (counts.get(hook) ?? 0) === 0)

    expect(missing).toEqual([])
  })

  it("keeps public examples off deprecated value-change props", () => {
    const exampleSources = listRepoFiles("libs/ui/registry/examples", ".tsx")
      .map((file) => readAbsolute(file))
      .join("\n")

    expect(exampleSources).not.toMatch(/<CommandPalette\b[^>]*\bselectedId=/)
    expect(exampleSources).not.toContain("onSelectedIdChange=")
    expect(exampleSources).not.toContain("onValueChange=")
    expect(exampleSources).not.toMatch(/<Checkbox\b[^>]*\bonCheckedChange=/)
    expect(exampleSources).not.toMatch(/<Radio\b[^>]*\bonCheckedChange=/)
  })

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
    ].join("\n")

    expect(docs).not.toMatch(/\bMenu\b[\s\S]{0,120}\bhighlighted,/)
    expect(docs).not.toMatch(/\bNavigationList\b[\s\S]{0,160}\bhighlighted,/)
    expect(docs).not.toMatch(/\bNavigationList\b[\s\S]{0,160}\bisHighlighted\b/)
    expect(docs).not.toContain("isFocused")
    expect(docs).not.toContain("onHighlight props")
    expect(docs).not.toMatch(/headless (focus|keyboard)/)
    expect(docs).toContain("highlightedId")
    expect(docs).toContain("onHighlightChange")
    expect(docs).toContain("focused")
    expect(docs).toContain("built-in arrow navigation")
  })

  it("keeps public composition docs from promising opaque wrapper depth", () => {
    const docs = [
      readRepoFile("libs/ui/docs/content/patterns/compound-components.mdx"),
      ...listRepoFiles("libs/ui/registry/component-docs", ".ts").map(readAbsolute),
    ].join("\n")

    expect(docs).not.toMatch(/no matter how deep|arbitrarily nested|deeply nested/i)
    expect(docs).toContain("opaque wrapper")
    expect(docs).toContain("direct StepperContent child")
  })

  it("keeps public install snippets local-first or publish-gated", () => {
    const docs = [
      "libs/ui/README.md",
      "libs/keys/README.md",
      "cli/add/README.md",
      "cli/diffgazer/README.md",
      ...listRepoFiles("libs/ui/docs/content", ".mdx").map((file) =>
        file.slice(repoRoot.length + 1),
      ),
    ]

    for (const path of docs) {
      const source = readRepoFile(path)
      if (!/(npx @diffgazer\/add|pnpm dlx @diffgazer\/add|yarn dlx @diffgazer\/add|bunx @diffgazer\/add|npm install @diffgazer\/|npm install -g diffgazer)/.test(source)) {
        continue
      }

      expect(source, path).toMatch(/npm view|publish-gated|After Publication|after publication|after `@diffgazer\/add` is published|after its npm package is published/)
    }
  })

})
