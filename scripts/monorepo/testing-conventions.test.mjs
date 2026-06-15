import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const TEST_FILE_RE = /\.(?:test|spec)\.[cm]?[tj]sx?$/;
const FIRE_EVENT_CALL_RE = /\bfireEvent(?:\.\w+\s*\(|\s*\()/;
const UI_COMPONENT_TEST_RE = /^libs\/ui\/registry\/ui\/.+\.test\.tsx$/;

function listRepoFiles() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((file) => existsSync(file));
}

function listTestFiles() {
  return listRepoFiles().filter((file) => TEST_FILE_RE.test(file));
}

test("retained fireEvent calls carry inline rationale", () => {
  const violations = [];

  for (const file of listTestFiles()) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
      if (line.trimStart().startsWith("//")) return;
      if (!FIRE_EVENT_CALL_RE.test(line)) return;

      const context = lines.slice(Math.max(0, index - 2), index + 1).join("\n");
      if (!context.includes("fireEvent retained:")) {
        violations.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(violations, []);
});

test("UI component tests run axe or document why axe is skipped", () => {
  const violations = [];

  for (const file of listTestFiles().filter((path) => UI_COMPONENT_TEST_RE.test(path))) {
    const text = readFileSync(file, "utf8");

    if (!/\baxe\s*\(/.test(text) && !text.includes("axe skipped:")) {
      violations.push(file);
    }
  }

  assert.deepEqual(violations, []);
});
