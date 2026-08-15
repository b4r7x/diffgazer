import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const configPath = join(repoRoot, ".dependency-cruiser.cjs");
const configSource = readFileSync(configPath, "utf8");
const depcruiseBin = join(
  repoRoot,
  "node_modules",
  "dependency-cruiser",
  "bin",
  "dependency-cruise.mjs",
);

// Cruises a throwaway source tree with the real config, so the rules are exercised the way
// `pnpm run depcruise` exercises them: against resolved module paths, not config text.
function cruiseFixture(files, { links = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "dg-depcruise-"));
  try {
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(join(root, dirname(path)), { recursive: true });
      writeFileSync(join(root, path), source);
    }
    for (const { path, target } of links) {
      const linkPath = join(root, path);
      mkdirSync(dirname(linkPath), { recursive: true });
      symlinkSync(target, linkPath, "dir");
    }

    const run = spawnSync(
      process.execPath,
      [depcruiseBin, "--config", configPath, "--output-type", "json", "apps"],
      { cwd: root, encoding: "utf8" },
    );
    assert.ok(run.stdout, run.stderr);

    return JSON.parse(run.stdout).summary.violations.map(
      (violation) => `${violation.rule.name}: ${violation.from} -> ${violation.to}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("components-not-features matches resolved cli/diffgazer feature paths", () => {
  assert.match(
    configSource,
    /name:\s*"components-not-features"[\s\S]*path:\s*\[[^\]]*"\^cli\/diffgazer\/src\/features\/"/,
    "dependency-cruiser must reject shared components importing cli/diffgazer features by resolved path",
  );
});

test("package-exported catalog bundle evidence is exempt as testing support", () => {
  assert.ok(
    configSource.includes('"^libs/core/src/testing/catalog-bundle-evidence\\\\.ts$"'),
    "the package-exported catalog bundle-evidence helper must remain an explicit no-orphans exemption",
  );
});

test("a relative import into a sibling app feature is rejected", () => {
  const violations = cruiseFixture({
    "apps/web/src/features/providers/lib/filter.ts": "export const filter = 1;\n",
    "apps/web/src/features/settings/components/page.ts":
      'import { filter } from "../../providers/lib/filter";\nexport const page = filter;\n',
    "apps/docs/src/features/theme/lib/token.ts": "export const token = 1;\n",
    "apps/docs/src/features/home/components/view.ts":
      'import { token } from "../../theme/lib/token";\nexport const view = token;\n',
  });

  assert.deepEqual(violations.sort(), [
    "no-cross-feature-apps: apps/docs/src/features/home/components/view.ts -> apps/docs/src/features/theme/lib/token.ts",
    "no-cross-feature-apps: apps/web/src/features/settings/components/page.ts -> apps/web/src/features/providers/lib/filter.ts",
  ]);
});

test("a relative import inside one app feature stays allowed", () => {
  const violations = cruiseFixture({
    "apps/web/src/features/providers/lib/filter.ts": "export const filter = 1;\n",
    "apps/web/src/features/providers/components/list.ts":
      'import { filter } from "../lib/filter";\nexport const list = filter;\n',
  });

  assert.deepEqual(violations, []);
});

test("a relative import from shared components into an app feature is rejected", () => {
  const violations = cruiseFixture({
    "apps/web/src/features/providers/lib/filter.ts": "export const filter = 1;\n",
    "apps/web/src/components/layout/shell.ts":
      'import { filter } from "../../features/providers/lib/filter";\nexport const shell = filter;\n',
  });

  assert.deepEqual(violations, [
    "components-not-features: apps/web/src/components/layout/shell.ts -> apps/web/src/features/providers/lib/filter.ts",
  ]);
});

test("landing-only-ui rejects a resolved non-UI workspace package edge", () => {
  const violations = cruiseFixture(
    {
      "apps/landing/src/main.ts":
        'import { createApi } from "@diffgazer/core/api";\nexport const page = createApi;\n',
      "libs/core/package.json": JSON.stringify({
        name: "@diffgazer/core",
        exports: { "./api": { import: "./dist/api/index.js" } },
      }),
      "libs/core/dist/api/index.js": "export const createApi = 1;\n",
    },
    {
      links: [
        {
          path: "apps/landing/node_modules/@diffgazer/core",
          target: "../../../../libs/core",
        },
      ],
    },
  );

  assert.equal(
    violations.filter((violation) => violation.startsWith("landing-only-ui:")).length,
    1,
    "resolved workspace package imports must remain visible to the landing boundary rule",
  );
});
