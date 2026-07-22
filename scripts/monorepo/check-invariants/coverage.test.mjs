import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { INVARIANT_CHECKS } from "../check-invariants.mjs";
import {
  createConformingFixture,
  PACKAGE_FILES,
  resultByName,
  runFixture,
  STALE_DOCS_E2E_SNAPSHOT_PATH,
  trackedFileEntry,
  updatePackage,
  writeJson,
  writeText,
} from "./fixture.mjs";

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
    name: "pnpm pins match root packageManager",
    mutate: (root) =>
      writeText(
        root,
        "deploy/landing.Dockerfile",
        "RUN corepack prepare pnpm@10.28.2 --activate\n",
      ),
  },
  {
    name: "Docker artifact builds copy formatter inputs",
    mutate: (root) =>
      writeText(
        root,
        "deploy/landing.Dockerfile",
        ["COPY biome.json ./", "RUN corepack prepare pnpm@11.13.0 --activate", ""].join("\n"),
      ),
  },
  {
    name: "Docker frozen installs copy configured patches",
    mutate: (root) =>
      writeText(
        root,
        "deploy/landing.Dockerfile",
        [
          "COPY biome.json .gitignore ./",
          "RUN corepack prepare pnpm@11.13.0 --activate",
          "RUN pnpm install --frozen-lockfile",
          "",
        ].join("\n"),
      ),
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
    name: "e2e screenshots use configured baseline directory",
    mutate: (root) => writeText(root, STALE_DOCS_E2E_SNAPSHOT_PATH, "stale"),
    options: {
      commandOutputs: {
        gitLsFilesStaged: trackedFileEntry(STALE_DOCS_E2E_SNAPSHOT_PATH),
      },
    },
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
    name: "@diffgazer/core uses explicit subpath exports without a root entry",
    mutate: (root) =>
      updatePackage(root, "libs/core/package.json", (pkg) => ({
        ...pkg,
        exports: { ...pkg.exports, ".": "./dist/index.js" },
      })),
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
    name: "publishable packages set publish metadata policy",
    mutate: (root) =>
      updatePackage(root, "libs/ui/package.json", (pkg) => ({
        ...pkg,
        publishConfig: { access: "public" },
      })),
  },
  {
    name: "publishable package set matches fixed policy list",
    mutate: (root) =>
      updatePackage(root, "libs/registry/package.json", (pkg) => {
        const rest = { ...pkg };
        delete rest.private;
        return { ...rest, publishConfig: { access: "public", provenance: true } };
      }),
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
  {
    name: "security and support reporting channels match root policy",
    mutate: (root) =>
      writeText(
        root,
        "cli/add/SECURITY.md",
        "Report through https://github.com/b4r7x/diffgazer/security/advisories/new\n",
      ),
  },
  {
    name: "dependency overrides match governance doc",
    mutate: (root) => {
      writeText(
        root,
        "pnpm-workspace.yaml",
        "packages:\n  - apps/*\noverrides:\n  leftpad: ^1.0.0\n",
      );
      writeText(
        root,
        "PACKAGE_GOVERNANCE.md",
        "## Dependency Governance\n\nNo pins documented here.\n\n## Licensing\n",
      );
    },
  },
  {
    name: "licensed packages appear in governance split",
    mutate: (root) =>
      writeText(
        root,
        "PACKAGE_GOVERNANCE.md",
        "## Licensing\n\n- **MIT** covers `libs/keys`.\n- **Apache-2.0** covers `cli/diffgazer`.\n",
      ),
  },
  {
    name: "surface env.example keys stay in root .env.example",
    mutate: (root) => writeText(root, "apps/landing/.env.example", "ORPHAN_ONLY=1\n"),
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

test("check-invariants CLI entry exits nonzero with a failure header and a named FAIL diagnostic", () => {
  const root = createConformingFixture();
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });
  rmSync(join(root, "SUPPORT.md"));

  const scriptPath = join(import.meta.dirname, "..", "check-invariants.mjs");

  assert.throws(
    () => execFileSync("node", [scriptPath], { cwd: root, encoding: "utf8" }),
    (error) => {
      assert.notEqual(error.status, 0);
      assert.match(error.stderr, /Invariant checks failed/);
      assert.match(error.stdout, /root policy files exist: FAIL/);
      return true;
    },
  );
});
