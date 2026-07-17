import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { localDependencySpecs } from "./smoke-package-runner.mjs";

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

    assert.match(specs.get("direct-dependency"), /^link:/);
    assert.match(specs.get("optional-dependency"), /^link:/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
