import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createPackageTarballCache, localDependencySpecs } from "./smoke-package-runner.mjs";

const repoRoot = process.cwd();

test("offline package smoke links regular and optional runtime dependencies", () => {
  const root = mkdtempSync(join(tmpdir(), "diffgazer-package-smoke-"));
  const packageDir = join(root, "cli/diffgazer");

  try {
    mkdirSync(join(packageDir, "node_modules/direct-dependency"), { recursive: true });
    mkdirSync(join(packageDir, "node_modules/optional-dependency"), { recursive: true });
    writeFileSync(
      join(packageDir, "package.json"),
      JSON.stringify({
        dependencies: { "direct-dependency": "^1.0.0" },
        optionalDependencies: { "optional-dependency": "^1.0.0" },
      }),
    );

    const specs = localDependencySpecs(root, "diffgazer", {});

    assert.equal(
      specs.get("direct-dependency"),
      `link:${realpathSync(join(packageDir, "node_modules/direct-dependency"))}`,
    );
    assert.equal(
      specs.get("optional-dependency"),
      `link:${realpathSync(join(packageDir, "node_modules/optional-dependency"))}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("package smoke cache packs each immutable workspace tarball once", async () => {
  const packInvocations = [];
  const cache = createPackageTarballCache(repoRoot, {
    packDir: "/virtual/package-smoke-cache",
    pack: async (_root, workspacePackage, packDir) => {
      packInvocations.push(workspacePackage);
      return resolve(packDir, `${workspacePackage.replaceAll("/", "-")}.tgz`);
    },
    cleanup: () => {},
  });

  const tarballs = await Promise.all([
    cache.get("@diffgazer/ui"),
    cache.get("@diffgazer/keys"),
    cache.get("@diffgazer/ui"),
    cache.get("@diffgazer/keys"),
  ]);

  assert.equal(tarballs[0], tarballs[2]);
  assert.equal(tarballs[1], tarballs[3]);
  assert.deepEqual(packInvocations, ["@diffgazer/ui", "@diffgazer/keys"]);
  cache.dispose();
});
