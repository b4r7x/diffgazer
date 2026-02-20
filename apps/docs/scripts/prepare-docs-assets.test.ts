import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareDocsAssets } from "./prepare-docs-assets";

const cleanupDirs: string[] = [];
const INITIAL_DIFFUI_ROOT = process.env.DIFFUI_ROOT;
const INITIAL_KEYSCOPE_ROOT = process.env.KEYSCOPE_ROOT;

function restoreEnvVariable(name: "DIFFUI_ROOT" | "KEYSCOPE_ROOT", value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

afterEach(() => {
  for (const dir of cleanupDirs.splice(0, cleanupDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }

  restoreEnvVariable("DIFFUI_ROOT", INITIAL_DIFFUI_ROOT);
  restoreEnvVariable("KEYSCOPE_ROOT", INITIAL_KEYSCOPE_ROOT);
});

function createWorkspace(): { workspaceRoot: string; appRoot: string } {
  const root = mkdtempSync(join(tmpdir(), "dgz-docs-assets-"));
  cleanupDirs.push(root);
  const workspaceRoot = join(root, "diffgazer");
  const appRoot = join(workspaceRoot, "apps/docs");
  mkdirSync(appRoot, { recursive: true });
  return { workspaceRoot, appRoot };
}

function addPackageFile(
  workspaceRoot: string,
  packageName: string,
  relativePath: string,
  content: string,
): void {
  const fullPath = join(workspaceRoot, "node_modules", packageName, relativePath);
  writeProjectFile(fullPath, content);
}

function createPackage(workspaceRoot: string, packageName: string, version: string): void {
  const packageRoot = join(workspaceRoot, "node_modules", packageName);
  mkdirSync(packageRoot, { recursive: true });
  writeProjectFile(
    join(packageRoot, "package.json"),
    JSON.stringify({ name: packageName, version }, null, 2),
  );
}

function writeProjectFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function createLocalDiffUi(root: string, version: string): string {
  const diffUiRoot = join(root, "diff-ui");
  mkdirSync(diffUiRoot, { recursive: true });
  writeProjectFile(join(diffUiRoot, "package.json"), JSON.stringify({ name: "diffui", version }, null, 2));
  writeProjectFile(
    join(diffUiRoot, "public/r/registry.json"),
    '{"items":[{"registryDependencies":["https://diffui.dev/r/keyscope/navigation.json"]}]}',
  );
  writeProjectFile(join(diffUiRoot, "docs/content/index.mdx"), "Install from https://diffui.dev/r");
  writeProjectFile(
    join(diffUiRoot, "docs/content/meta.json"),
    JSON.stringify(
      {
        title: "Documentation",
        root: true,
        pages: ["index"],
      },
      null,
      2,
    ),
  );
  writeProjectFile(join(diffUiRoot, "docs/generated/component-list.json"), "[]");
  writeProjectFile(
    join(diffUiRoot, "docs/generated/demo-index.ts"),
    'import { lazy } from "react"\n' +
      'import type { ComponentType, LazyExoticComponent } from "react"\n\n' +
      "export const demos: Record<string, LazyExoticComponent<ComponentType>> = {\n" +
      '  "button-default": lazy(() => import("../../../../registry/examples/button/button-default")),\n' +
      "}\n",
  );
  writeProjectFile(
    join(diffUiRoot, "registry/registry.json"),
    '{"items":[{"registryDependencies":["https://diffui.dev/r/keyscope/navigation.json"]}]}',
  );
  writeProjectFile(join(diffUiRoot, "styles/theme.css"), ":root{}");
  return diffUiRoot;
}

function createLocalKeyscope(root: string, version: string): string {
  const keyscopeRoot = join(root, "keyscope");
  mkdirSync(keyscopeRoot, { recursive: true });
  writeProjectFile(join(keyscopeRoot, "package.json"), JSON.stringify({ name: "keyscope", version }, null, 2));
  writeProjectFile(join(keyscopeRoot, "public/r/registry.json"), '{"name":"keyscope"}');
  writeProjectFile(join(keyscopeRoot, "docs/api.md"), "# keyscope api");
  writeProjectFile(join(keyscopeRoot, "src/index.ts"), "export function useKey() { return null }\n");
  return keyscopeRoot;
}

describe("prepareDocsAssets", () => {
  it("copies registries, docs, vendor source and rewrites host references", () => {
    const { workspaceRoot, appRoot } = createWorkspace();

    createPackage(workspaceRoot, "diffui", "1.0.0");
    addPackageFile(
      workspaceRoot,
      "diffui",
      "dist/artifacts/registry/registry.json",
      '{"items":[{"registryDependencies":["https://diffui.dev/r/keyscope/navigation.json"]}]}',
    );
    addPackageFile(workspaceRoot, "diffui", "dist/artifacts/docs/index.mdx", "Install from https://diffui.dev/r");
    addPackageFile(
      workspaceRoot,
      "diffui",
      "dist/artifacts/docs/meta.json",
      JSON.stringify(
        {
          title: "Documentation",
          root: true,
          pages: ["index", "---CLI---", "...cli"],
        },
        null,
        2,
      ),
    );
    addPackageFile(
      workspaceRoot,
      "diffui",
      "dist/artifacts/docs/integrations/keyscope.mdx",
      "Dependency https://diffui.dev/r/keyscope/navigation.json",
    );
    addPackageFile(workspaceRoot, "diffui", "dist/artifacts/generated/component-list.json", "[]");
    addPackageFile(
      workspaceRoot,
      "diffui",
      "dist/artifacts/generated/demo-index.ts",
      'import { lazy } from "react"\n' +
        'import type { ComponentType, LazyExoticComponent } from "react"\n\n' +
        "export const demos: Record<string, LazyExoticComponent<ComponentType>> = {\n" +
        '  "button-default": lazy(() => import("../../../../registry/examples/button/button-default")),\n' +
        "}\n",
    );
    addPackageFile(
      workspaceRoot,
      "diffui",
      "dist/artifacts/source/registry/registry.json",
      '{"items":[{"registryDependencies":["https://diffui.dev/r/keyscope/focus-trap.json"]}]}',
    );
    addPackageFile(workspaceRoot, "diffui", "dist/artifacts/source/styles/theme.css", ":root{}");

    createPackage(workspaceRoot, "keyscope", "0.1.1");
    addPackageFile(workspaceRoot, "keyscope", "public/r/registry.json", '{"name":"keyscope"}');
    addPackageFile(workspaceRoot, "keyscope", "docs/api.md", "# keyscope api");
    addPackageFile(workspaceRoot, "keyscope", "src/index.ts", "export function useKey() { return null }\n");

    const summary = prepareDocsAssets({
      workspaceRoot,
      appRoot,
      docsHost: "https://docs.example.com",
    });

    expect(summary).toHaveLength(2);

    expect(
      readFileSync(join(appRoot, "public/r/diff-ui/registry.json"), "utf-8"),
    ).toContain("https://docs.example.com/r/keyscope/navigation.json");
    expect(
      readFileSync(join(appRoot, "public/r/keyscope/registry.json"), "utf-8"),
    ).toContain("keyscope");

    expect(
      readFileSync(join(appRoot, "vendor/registry/registry.json"), "utf-8"),
    ).toContain("https://docs.example.com/r/keyscope/focus-trap.json");
    expect(
      readFileSync(join(appRoot, "vendor/styles/theme.css"), "utf-8"),
    ).toContain(":root");
    expect(
      readFileSync(join(appRoot, "src/generated/demo-index.ts"), "utf-8"),
    ).toContain('../../vendor/registry/examples/button/button-default');
    expect(
      readFileSync(join(appRoot, "vendor/keyscope/src/index.ts"), "utf-8"),
    ).toContain("useKey");

    expect(
      readFileSync(join(appRoot, "content/generated-docs/index.mdx"), "utf-8"),
    ).toContain("https://docs.example.com/r/diff-ui");
    expect(
      readFileSync(join(appRoot, "content/generated-docs/integrations/keyscope.mdx"), "utf-8"),
    ).toContain("https://docs.example.com/r/keyscope/navigation.json");

    expect(
      readFileSync(join(appRoot, "content/generated-docs/keyscope/api.mdx"), "utf-8"),
    ).toContain("keyscope api");
    expect(
      readFileSync(join(appRoot, "content/generated-docs/meta.json"), "utf-8"),
    ).toContain("...keyscope");

    const sources = JSON.parse(
      readFileSync(join(appRoot, "src/generated/library-sources.json"), "utf-8"),
    ) as Array<{ id: string }>;
    expect(sources.map((item) => item.id)).toEqual(["diff-ui", "keyscope"]);
  });

  it("prefers local workspace checkouts over node_modules packages", () => {
    const { workspaceRoot, appRoot } = createWorkspace();
    const root = join(workspaceRoot, "..");
    const localDiffUiRoot = createLocalDiffUi(root, "2.0.0-local");
    const localKeyscopeRoot = createLocalKeyscope(root, "3.0.0-local");

    createPackage(workspaceRoot, "diffui", "9.9.9-package");
    addPackageFile(workspaceRoot, "diffui", "dist/artifacts/registry/registry.json", '{"name":"package-diffui"}');
    addPackageFile(workspaceRoot, "diffui", "dist/artifacts/docs/index.mdx", "package docs");
    addPackageFile(
      workspaceRoot,
      "diffui",
      "dist/artifacts/docs/meta.json",
      JSON.stringify(
        {
          title: "Documentation",
          root: true,
          pages: ["index"],
        },
        null,
        2,
      ),
    );
    addPackageFile(workspaceRoot, "diffui", "dist/artifacts/generated/component-list.json", "[]");
    addPackageFile(
      workspaceRoot,
      "diffui",
      "dist/artifacts/generated/demo-index.ts",
      'import { lazy } from "react"\n' +
        'import type { ComponentType, LazyExoticComponent } from "react"\n\n' +
        "export const demos: Record<string, LazyExoticComponent<ComponentType>> = {\n" +
        '  "button-default": lazy(() => import("../../../../registry/examples/button/button-default")),\n' +
        "}\n",
    );
    addPackageFile(workspaceRoot, "diffui", "dist/artifacts/source/registry/registry.json", '{"name":"source"}');
    addPackageFile(workspaceRoot, "diffui", "dist/artifacts/source/styles/theme.css", ":root{}");

    createPackage(workspaceRoot, "keyscope", "9.9.9-package");
    addPackageFile(workspaceRoot, "keyscope", "public/r/registry.json", '{"name":"package-keyscope"}');
    addPackageFile(workspaceRoot, "keyscope", "docs/api.md", "# package keyscope");
    addPackageFile(workspaceRoot, "keyscope", "src/index.ts", "export const packageKeyscope = true\n");

    const summary = prepareDocsAssets({
      workspaceRoot,
      appRoot,
      docsHost: "https://docs.example.com",
    });

    expect(summary).toEqual([
      {
        id: "diff-ui",
        packageName: "diffui",
        version: "2.0.0-local",
        sourceRoot: localDiffUiRoot,
      },
      {
        id: "keyscope",
        packageName: "keyscope",
        version: "3.0.0-local",
        sourceRoot: localKeyscopeRoot,
      },
    ]);
  });

  it("respects DIFFUI_ROOT and KEYSCOPE_ROOT overrides", () => {
    const { workspaceRoot, appRoot } = createWorkspace();

    const customDiffUiRoot = join(workspaceRoot, "custom/diff-ui");
    const customKeyscopeRoot = join(workspaceRoot, "custom/keyscope");
    createLocalDiffUi(join(customDiffUiRoot, ".."), "4.0.0-override");
    createLocalKeyscope(join(customKeyscopeRoot, ".."), "5.0.0-override");

    const prevDiffUiRoot = process.env.DIFFUI_ROOT;
    const prevKeyscopeRoot = process.env.KEYSCOPE_ROOT;
    process.env.DIFFUI_ROOT = "./custom/diff-ui";
    process.env.KEYSCOPE_ROOT = "./custom/keyscope";

    try {
      const summary = prepareDocsAssets({
        workspaceRoot,
        appRoot,
        docsHost: "https://docs.example.com",
      });

      expect(summary).toEqual([
        {
          id: "diff-ui",
          packageName: "diffui",
          version: "4.0.0-override",
          sourceRoot: customDiffUiRoot,
        },
        {
          id: "keyscope",
          packageName: "keyscope",
          version: "5.0.0-override",
          sourceRoot: customKeyscopeRoot,
        },
      ]);
    } finally {
      restoreEnvVariable("DIFFUI_ROOT", prevDiffUiRoot);
      restoreEnvVariable("KEYSCOPE_ROOT", prevKeyscopeRoot);
    }
  });

  it("throws when required diffui artifacts are missing", () => {
    const { workspaceRoot, appRoot } = createWorkspace();
    createPackage(workspaceRoot, "diffui", "1.0.0");

    expect(() =>
      prepareDocsAssets({
        workspaceRoot,
        appRoot,
        docsHost: "https://docs.example.com",
      }),
    ).toThrow('Required directory for "diffui" not found');
  });
});
