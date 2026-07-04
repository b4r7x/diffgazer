import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { listRepoFiles } from "./lib/files.mjs";

const TEST_FILE_RE = /\.(?:test|spec)\.[cm]?[tj]sx?$/;
const FIRE_EVENT_CALL_RE = /\bfireEvent(?:\.\w+\s*\(|\s*\()/;
const UI_COMPONENT_FILE_RE = /^libs\/ui\/registry\/ui\/([^/]+)\//;
const UI_COMPONENT_TEST_RE = /^libs\/ui\/registry\/ui\/.+\.test\.tsx$/;
const UI_COMPONENT_DIRECT_TEST_RE = /^libs\/ui\/registry\/ui\/([^/]+)\/[^/]+\.test\.tsx$/;
const AXE_SKIP_RE = /axe skipped:\s*\S/;
const UI_COMPONENT_AXE_EXEMPTIONS = new Map();

function listTestFiles() {
  return listRepoFiles().filter((file) => existsSync(file) && TEST_FILE_RE.test(file));
}

function listUiComponentFolders() {
  const folders = new Set();

  for (const file of listRepoFiles()) {
    if (!existsSync(file)) continue;
    const match = UI_COMPONENT_FILE_RE.exec(file);
    if (match) folders.add(match[1]);
  }

  return [...folders].sort();
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
  const componentFolders = listUiComponentFolders();
  const foldersWithDirectTests = new Set();

  for (const file of listTestFiles().filter((path) => UI_COMPONENT_TEST_RE.test(path))) {
    const text = readFileSync(file, "utf8");
    const directTestMatch = UI_COMPONENT_DIRECT_TEST_RE.exec(file);
    if (directTestMatch) foldersWithDirectTests.add(directTestMatch[1]);

    if (!/\baxe\s*\(/.test(text) && !AXE_SKIP_RE.test(text)) {
      violations.push(file);
    }
  }

  for (const folder of componentFolders) {
    if (foldersWithDirectTests.has(folder)) continue;

    const rationale = UI_COMPONENT_AXE_EXEMPTIONS.get(folder)?.trim();
    if (!rationale) {
      violations.push(`libs/ui/registry/ui/${folder}/`);
    }
  }

  for (const [folder, rationale] of UI_COMPONENT_AXE_EXEMPTIONS) {
    if (!rationale.trim()) violations.push(`libs/ui/registry/ui/${folder}/: empty axe exemption`);
    if (!componentFolders.includes(folder)) {
      violations.push(`libs/ui/registry/ui/${folder}/: stale axe exemption`);
    }
  }

  assert.deepEqual(violations, []);
});
