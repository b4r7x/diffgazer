import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { INVARIANT_CHECKS, runInvariantChecks } from "./check-invariants.mjs";

const PACKAGE_FILES = [
  "apps/docs/package.json",
  "apps/landing/package.json",
  "apps/web/package.json",
  "cli/add/package.json",
  "cli/diffgazer/package.json",
  "cli/server/package.json",
  "libs/core/package.json",
  "libs/keys/package.json",
  "libs/registry/package.json",
  "libs/ui/package.json",
];

const EMPTY_COMMAND_OUTPUTS = {
  gitLsFilesStaged: "",
  nestedRepoConfig: "",
  nestedGitDirs: "",
  nestedLocks: "",
  nestedWorkspaces: "",
};

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "dg-invariants-"));
  tempRoots.push(root);
  return root;
}

function writeText(root, relPath, content) {
  const path = join(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeJson(root, relPath, value) {
  writeText(root, relPath, `${JSON.stringify(value, null, 2)}\n`);
}

function readPackage(root, relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

function updatePackage(root, relPath, update) {
  writeJson(root, relPath, update(readPackage(root, relPath)));
}

function createWorkspacePackage(root, relPath, pkg) {
  writeJson(root, relPath, pkg);
}

function writePackagePolicyFiles(root, packageDir, licenseText = "MIT License\n") {
  for (const file of ["README.md", "SECURITY.md", "SUPPORT.md"]) {
    writeText(root, `${packageDir}/${file}`, `${file}\n`);
  }
  writeText(root, `${packageDir}/LICENSE`, licenseText);
}

function createConformingFixture() {
  const root = makeTempRoot();

  writeJson(root, "package.json", {
    private: true,
    repository: { url: "git+https://github.com/b4r7x/diffgazer.git" },
    homepage: "https://github.com/b4r7x/diffgazer",
    bugs: { url: "https://github.com/b4r7x/diffgazer/issues" },
    scripts: { "web:build": "turbo run build --filter=@diffgazer/web" },
  });
  writeText(root, "SECURITY.md", "security\n");
  writeText(root, "SUPPORT.md", "support\n");
  writeText(
    root,
    "pnpm-workspace.yaml",
    [
      "packages:",
      "  - apps/*",
      "  - cli/*",
      "  - libs/*",
      "  - libs/keys/artifacts",
      "  - libs/keys/examples/*",
      "",
    ].join("\n"),
  );
  writeJson(root, "turbo.json", {
    tasks: { "@diffgazer/docs#build": { outputs: ["dist/**", ".output/**"] } },
  });

  createWorkspacePackage(root, "apps/docs/package.json", {
    name: "@diffgazer/docs",
    private: true,
  });
  createWorkspacePackage(root, "apps/landing/package.json", {
    name: "@diffgazer/landing",
    private: true,
  });
  createWorkspacePackage(root, "apps/web/package.json", {
    name: "@diffgazer/web",
    private: true,
  });
  createWorkspacePackage(root, "cli/server/package.json", {
    name: "@diffgazer/server",
    private: true,
  });
  createWorkspacePackage(root, "libs/core/package.json", {
    name: "@diffgazer/core",
    private: true,
  });
  createWorkspacePackage(root, "libs/registry/package.json", {
    name: "@diffgazer/registry",
    private: true,
  });

  createWorkspacePackage(root, "libs/ui/package.json", {
    name: "@diffgazer/ui",
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "libs/ui",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/libs/ui",
    sideEffects: ["**/*.css"],
    files: ["dist", "LICENSE", "README.md", "SECURITY.md", "SUPPORT.md"],
    exports: {
      ".": "./dist/index.js",
      "./components/button": "./dist/components/button.js",
      "./hooks/use-demo": "./dist/hooks/use-demo.js",
      "./lib/utils": "./dist/lib/utils.js",
      "./theme-base.css": "./theme-base.css",
      "./theme.css": "./theme.css",
      "./sources.css": "./sources.css",
      "./styles.css": "./styles.css",
    },
    publishConfig: { access: "public" },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "libs/ui");

  createWorkspacePackage(root, "libs/keys/package.json", {
    name: "@diffgazer/keys",
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "libs/keys",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/libs/keys",
    sideEffects: false,
    files: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    exports: { ".": "./dist/index.js" },
    publishConfig: { access: "public" },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "libs/keys");

  createWorkspacePackage(root, "cli/diffgazer/package.json", {
    name: "diffgazer",
    bin: { diffgazer: "bin/diffgazer.js" },
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "cli/diffgazer",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/cli/diffgazer",
    files: ["dist", "bin/diffgazer.js", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    publishConfig: { access: "public" },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "cli/diffgazer", "Apache License\n");

  createWorkspacePackage(root, "cli/add/package.json", {
    name: "@diffgazer/add",
    bin: { dgadd: "dist/index.js" },
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "cli/add",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/cli/add",
    files: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    publishConfig: { access: "public" },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "cli/add");

  return root;
}

function runFixture(root, options = {}) {
  return runInvariantChecks({
    rootDir: root,
    packageFiles: options.packageFiles ?? PACKAGE_FILES,
    commandOutputs: { ...EMPTY_COMMAND_OUTPUTS, ...(options.commandOutputs ?? {}) },
    checks: options.checks,
  });
}

function resultByName(results, name) {
  const result = results.find((entry) => entry.name === name);
  assert.ok(result, `missing result ${name}`);
  return result;
}

test("the conforming fixture passes every invariant", () => {
  const root = createConformingFixture();
  const failures = runFixture(root).filter((result) => !result.ok);

  assert.deepEqual(failures, []);
});

const failureCases = [
  {
    name: "root workspace file exists",
    mutate: (root) => rmSync(join(root, "pnpm-workspace.yaml")),
  },
  {
    name: "root policy files exist",
    mutate: (root) => rmSync(join(root, "SUPPORT.md")),
  },
  {
    name: "root repository metadata",
    mutate: (root) =>
      updatePackage(root, "package.json", (pkg) => ({ ...pkg, homepage: "https://example.com" })),
  },
  {
    name: "workspace globs match target roots",
    mutate: (root) => writeText(root, "pnpm-workspace.yaml", "packages:\n  - apps/*\n"),
  },
  {
    name: "no .gitmodules",
    mutate: (root) => writeText(root, ".gitmodules", "[submodule]\n"),
  },
  {
    name: "no gitlink entries",
    options: { commandOutputs: { gitLsFilesStaged: "160000 abcdef 0\tvendor/lib\n" } },
  },
  {
    name: "no nested repo config",
    options: { commandOutputs: { nestedRepoConfig: "submodule.vendor.url git@example.com:x/y" } },
  },
  {
    name: "no nested .git directories",
    options: { commandOutputs: { nestedGitDirs: "./vendor/.git\n" } },
  },
  {
    name: "no nested pnpm-lock.yaml",
    options: { commandOutputs: { nestedLocks: "./vendor/pnpm-lock.yaml\n" } },
  },
  {
    name: "no nested pnpm-workspace.yaml",
    options: { commandOutputs: { nestedWorkspaces: "./vendor/pnpm-workspace.yaml\n" } },
  },
  {
    name: "no link: or file: local deps",
    mutate: (root) =>
      updatePackage(root, "apps/docs/package.json", (pkg) => ({
        ...pkg,
        dependencies: { fixture: "file:../fixture" },
      })),
  },
  {
    name: "internal local deps use workspace protocol",
    mutate: (root) =>
      updatePackage(root, "apps/docs/package.json", (pkg) => ({
        ...pkg,
        dependencies: { "@diffgazer/ui": "^1.0.0" },
      })),
  },
  {
    name: "package license fields match LICENSE files",
    mutate: (root) =>
      updatePackage(root, "libs/ui/package.json", (pkg) => ({ ...pkg, license: "MIT" })),
    afterMutate: (root) => writeText(root, "libs/ui/LICENSE", "Apache License\n"),
  },
  {
    name: "workspace package list under target roots",
    options: { packageFiles: PACKAGE_FILES.filter((path) => path !== "apps/web/package.json") },
  },
  {
    name: "nested package.json files are documented exceptions",
    mutate: (root) => writeJson(root, "apps/web/fixtures/package.json", { name: "fixture" }),
    options: { packageFiles: [...PACKAGE_FILES, "apps/web/fixtures/package.json"] },
  },
  {
    name: "libs/ui/package.json: package metadata",
    mutate: (root) =>
      updatePackage(root, "libs/ui/package.json", (pkg) => {
        const exports = { ...pkg.exports };
        delete exports["./components/button"];
        return { ...pkg, exports };
      }),
  },
  {
    name: "libs/keys/package.json: package metadata",
    mutate: (root) =>
      updatePackage(root, "libs/keys/package.json", (pkg) => ({ ...pkg, sideEffects: [] })),
  },
  {
    name: "cli/diffgazer/package.json: CLI package metadata",
    mutate: (root) =>
      updatePackage(root, "cli/diffgazer/package.json", (pkg) => {
        const rest = { ...pkg };
        delete rest.bin;
        return rest;
      }),
  },
  {
    name: "cli/add/package.json: CLI package metadata",
    mutate: (root) =>
      updatePackage(root, "cli/add/package.json", (pkg) => ({ ...pkg, private: true })),
  },
  {
    name: "no publishable package ships internal-docs-manifest.json",
    mutate: (root) =>
      updatePackage(root, "libs/ui/package.json", (pkg) => ({
        ...pkg,
        files: [...pkg.files, "internal-docs-manifest.json"],
      })),
  },
  {
    name: "publishable packages share one engines.node",
    mutate: (root) =>
      updatePackage(root, "cli/add/package.json", (pkg) => ({
        ...pkg,
        engines: { node: ">=20.0.0" },
      })),
  },
  {
    name: "turbo docs build includes .output",
    mutate: (root) =>
      writeJson(root, "turbo.json", {
        tasks: { "@diffgazer/docs#build": { outputs: ["dist/**"] } },
      }),
  },
  {
    name: "web:build uses turbo for dependency chain",
    mutate: (root) =>
      updatePackage(root, "package.json", (pkg) => ({
        ...pkg,
        scripts: { ...pkg.scripts, "web:build": "vite build" },
      })),
  },
];

test("failure fixtures cover every exported invariant check", () => {
  assert.equal(failureCases.length, INVARIANT_CHECKS.length);
});

for (const [index, fixtureCase] of failureCases.entries()) {
  test(`${fixtureCase.name} fails on a minimal violating fixture`, () => {
    const root = createConformingFixture();
    fixtureCase.mutate?.(root);
    fixtureCase.afterMutate?.(root);

    const result = resultByName(
      runFixture(root, { ...fixtureCase.options, checks: [INVARIANT_CHECKS[index]] }),
      fixtureCase.name,
    );

    assert.equal(result.ok, false);
  });
}
