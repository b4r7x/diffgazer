import { spawnSync } from "node:child_process";
import { afterEach, expect, test } from "vitest";
import { dgaddChildEnv } from "./child-env.js";

const PRINT_STYLED = 'process.stdout.write(require("node:util").styleText("red", "ok"))';

const originalForceColor = process.env.FORCE_COLOR;

afterEach(() => {
  if (originalForceColor === undefined) delete process.env.FORCE_COLOR;
  else process.env.FORCE_COLOR = originalForceColor;
});

test("a spawned child prints plain, warning-free output when the parent forces colour", () => {
  process.env.FORCE_COLOR = "1";

  const result = spawnSync(process.execPath, ["-e", PRINT_STYLED], {
    encoding: "utf-8",
    env: dgaddChildEnv(),
  });

  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("ok");
});

test("caller overrides reach the child", () => {
  const result = spawnSync(
    process.execPath,
    ["-e", "process.stdout.write(process.env.PATH ?? '')"],
    {
      encoding: "utf-8",
      env: dgaddChildEnv({ PATH: "/fake-bin" }),
    },
  );

  expect(result.stdout).toBe("/fake-bin");
});
