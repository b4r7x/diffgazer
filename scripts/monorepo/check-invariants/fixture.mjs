import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach } from "node:test";
import { runInvariantChecks } from "../check-invariants.mjs";
import { CANONICAL_MIT_LICENSE } from "./packages.mjs";

export const PACKAGE_FILES = [
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

export const FIXTURE_REPO_FILES = ["Dockerfile", "deploy/landing.Dockerfile"];

export const STALE_DOCS_E2E_SNAPSHOT_PATH =
  "apps/docs/testing/e2e/select.e2e.ts-snapshots/select-listbox-open-chromium-darwin.png";

const EMPTY_COMMAND_OUTPUTS = {
  gitLsFilesStaged: "",
  gitLsFilesEnvExamples: "",
  submoduleConfig: "",
  nestedGitDirs: "",
  nestedLocks: "",
  nestedWorkspaces: "",
};

const CONFORMING_ENV_EXAMPLE_PATHS =
  ".env.example\napps/docs/.env.example\napps/landing/.env.example";

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

export function writeText(root, relPath, content) {
  const path = join(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function writeJson(root, relPath, value) {
  writeText(root, relPath, `${JSON.stringify(value, null, 2)}\n`);
}

export function setFileMtime(root, relPath, timeMs) {
  const time = new Date(timeMs);
  utimesSync(join(root, relPath), time, time);
}

export function trackedFileEntry(path) {
  return `100644 ${"a".repeat(40)} 0\t${path}\n`;
}

function readPackage(root, relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

export function updatePackage(root, relPath, update) {
  writeJson(root, relPath, update(readPackage(root, relPath)));
}

function createWorkspacePackage(root, relPath, pkg) {
  writeJson(root, relPath, pkg);
}

function writePackagePolicyFiles(root, packageDir, licenseText = CANONICAL_MIT_LICENSE) {
  for (const file of ["README.md", "SECURITY.md", "SUPPORT.md"]) {
    writeText(root, `${packageDir}/${file}`, `${file}\n`);
  }
  writeText(root, `${packageDir}/LICENSE`, licenseText);
}

export function createConformingFixture() {
  const root = makeTempRoot();

  writeJson(root, "package.json", {
    private: true,
    packageManager: "pnpm@11.13.0",
    repository: { url: "git+https://github.com/b4r7x/diffgazer.git" },
    homepage: "https://github.com/b4r7x/diffgazer",
    bugs: { url: "https://github.com/b4r7x/diffgazer/issues" },
    scripts: { "web:build": "turbo run build --filter=@diffgazer/web" },
  });
  writeText(root, "SECURITY.md", "security\n");
  writeText(root, "SUPPORT.md", "support\n");
  const dockerfile = [
    "COPY biome.json .gitignore ./",
    "COPY patches/ patches/",
    "RUN corepack prepare pnpm@11.13.0 --activate",
    "RUN pnpm install --frozen-lockfile",
    "",
  ].join("\n");
  writeText(root, "Dockerfile", dockerfile);
  writeText(root, "deploy/landing.Dockerfile", dockerfile);
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
      "overrides:",
      '  "@types/node": ^22.10.0',
      "patchedDependencies:",
      "  nitro@3.0.260429-beta: patches/nitro@3.0.260429-beta.patch",
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
    exports: {
      "./errors": "./dist/errors.js",
    },
  });
  createWorkspacePackage(root, "libs/registry/package.json", {
    name: "@diffgazer/registry",
    private: true,
    engines: { node: ">=22.0.0" },
  });

  createWorkspacePackage(root, "libs/ui/package.json", {
    name: "@diffgazer/ui",
    author: "diffgazer",
    license: "MIT",
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
    publishConfig: { access: "public", provenance: true },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "libs/ui");

  createWorkspacePackage(root, "libs/keys/package.json", {
    name: "@diffgazer/keys",
    author: "diffgazer",
    license: "MIT",
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "libs/keys",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/libs/keys",
    sideEffects: false,
    files: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    exports: { ".": "./dist/index.js" },
    publishConfig: { access: "public", provenance: true },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "libs/keys");
  // Fresh compiled bundle: src backdated so dist (written now) is newer.
  writeText(root, "libs/keys/src/index.ts", "export {};\n");
  setFileMtime(root, "libs/keys/src/index.ts", Date.now() - 60_000);
  writeText(root, "libs/keys/dist/index.js", "export {};\n");

  createWorkspacePackage(root, "cli/diffgazer/package.json", {
    name: "diffgazer",
    author: "diffgazer",
    license: "Apache-2.0",
    bin: { diffgazer: "./dist/index.js" },
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "cli/diffgazer",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/cli/diffgazer",
    files: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    publishConfig: { access: "public", provenance: true },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(
    root,
    "cli/diffgazer",
    [
      "Apache License",
      "(an example is provided in the Appendix below)",
      "link (or bind by name)",
      "(except as stated in this section) patent license",
      "cross-claim or counterclaim in a lawsuit",
      "(and each Contributor provides its Contributions)",
      "",
    ].join("\n"),
  );

  createWorkspacePackage(root, "cli/add/package.json", {
    name: "@diffgazer/add",
    author: "diffgazer",
    license: "MIT",
    bin: { dgadd: "dist/index.js" },
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "cli/add",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/cli/add",
    files: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    publishConfig: { access: "public", provenance: true },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "cli/add");

  for (const packageFile of PACKAGE_FILES) {
    updatePackage(root, packageFile, (pkg) => ({
      ...pkg,
      devDependencies: { ...pkg.devDependencies, "@types/node": "^22.10.0" },
    }));
  }
  writeText(
    root,
    ".github/actions/setup-repo/action.yml",
    "runs:\n  using: composite\n  steps:\n    - uses: actions/setup-node@fixture\n      with:\n        node-version: 22\n",
  );
  writeText(
    root,
    "PACKAGE_GOVERNANCE.md",
    [
      "## Dependency Governance",
      "",
      "- `@types/node` pinned to `^22.10.0`.",
      "",
      "## Licensing",
      "",
      "- **MIT** covers `cli/add`, `libs/keys`, and `libs/ui`.",
      "- **Apache-2.0** covers `cli/diffgazer`.",
      "",
    ].join("\n"),
  );
  const nodeTypeImporters = PACKAGE_FILES.flatMap((packageFile) => {
    const importer = packageFile.replace(/\/package\.json$/, "");
    const lines = [
      `  ${importer}:`,
      "    devDependencies:",
      "      '@types/node':",
      "        specifier: ^22.10.0",
      "        version: 22.19.0",
    ];
    return lines;
  });
  writeText(
    root,
    "pnpm-lock.yaml",
    [
      "lockfileVersion: '9.0'",
      "importers:",
      ...nodeTypeImporters,
      "packages:",
      "  '@types/node@22.19.0': {}",
      "",
    ].join("\n"),
  );

  writeText(root, ".env.example", ["CANONICAL_KEY=1", "VITE_SURFACE=1", ""].join("\n"));
  writeText(root, "apps/landing/.env.example", "VITE_SURFACE=1\n");
  writeText(root, "apps/docs/.env.example", "VITE_SURFACE=1\n");

  return root;
}

export function runFixture(root, options = {}) {
  return runInvariantChecks({
    rootDir: root,
    packageFiles: options.packageFiles ?? PACKAGE_FILES,
    repoFiles: options.repoFiles ?? FIXTURE_REPO_FILES,
    commandOutputs: {
      ...EMPTY_COMMAND_OUTPUTS,
      gitLsFilesEnvExamples: CONFORMING_ENV_EXAMPLE_PATHS,
      ...(options.commandOutputs ?? {}),
    },
    checks: options.checks,
  });
}

export function resultByName(results, name) {
  const result = results.find((entry) => entry.name === name);
  assert.ok(result, `missing result ${name}`);
  return result;
}
