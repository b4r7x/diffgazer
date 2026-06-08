import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { computeMissingDeps } from "./command.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-add-deps-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "fixture",
      dependencies: {
        "@diffgazer/keys": "^0.1.0",
        clsx: "^2.0.0",
      },
    }),
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("computeMissingDeps keys-version policy", () => {
  test("re-adds @diffgazer/keys when an explicit --keys-version differs from package.json", () => {
    const missing = computeMissingDeps(
      ["select"],
      { mode: "@diffgazer/keys", hasKeyboardIntegration: true },
      "^0.3.0",
      root,
    );

    expect(missing).toContain("@diffgazer/keys@^0.3.0");
  });

  test("skips @diffgazer/keys when the installed range already matches --keys-version", () => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "fixture",
        dependencies: { "@diffgazer/keys": "^0.3.0", clsx: "^2.0.0" },
      }),
    );

    const missing = computeMissingDeps(
      ["select"],
      { mode: "@diffgazer/keys", hasKeyboardIntegration: true },
      "^0.3.0",
      root,
    );

    expect(missing.some((dep) => dep.startsWith("@diffgazer/keys@"))).toBe(false);
  });
});
