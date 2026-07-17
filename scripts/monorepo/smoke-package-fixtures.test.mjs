import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  writeKeysPackageModeSmoke,
  writeKeysTestHelperSmoke,
  writeUiNextPackageSmoke,
} from "./smoke-package-fixtures.mjs";

const exceptionalClientEntries = [
  ["CodeBlockHighlight", "codeBlockHighlight", "@diffgazer/ui/components/code-block/highlight"],
  [
    "CommandPaletteHighlightItem",
    "commandPaletteHighlightItem",
    "@diffgazer/ui/components/command-palette/highlight",
  ],
];

test("Next package fixture retains both exceptional client entries in a Server Component", () => {
  const projectDir = mkdtempSync(join(tmpdir(), "diffgazer-ui-next-fixture-"));

  try {
    writeUiNextPackageSmoke(projectDir, projectDir);
    const page = readFileSync(join(projectDir, "app/page.tsx"), "utf8");
    const clientBoundary = readFileSync(
      join(projectDir, "app/highlight-client-boundaries.tsx"),
      "utf8",
    );

    assert.doesNotMatch(page, /^["']use client["'];/m);
    assert.match(clientBoundary, /^"use client";/);
    assert.doesNotMatch(clientBoundary, /defaultOpen/);
    assert.match(
      clientBoundary,
      /<CommandPalette open>[\s\S]*<CommandPalette\.Content>[\s\S]*<CommandPalette\.List>[\s\S]*<CommandPaletteHighlightItem\b/,
    );
    for (const [binding, prop, specifier] of exceptionalClientEntries) {
      assert.ok(
        page.includes(`import { ${binding} } from '${specifier}';`),
        `Next fixture is missing the ${specifier} import`,
      );
      assert.ok(
        page.includes(`${prop}={${binding}}`),
        `Next fixture does not pass ${binding} across its RSC boundary`,
      );
      assert.ok(
        clientBoundary.includes(`${prop}: ${binding}`),
        `Client boundary does not receive ${binding}`,
      );
      assert.match(clientBoundary, new RegExp(`<${binding}\\b`));
    }
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test("Keys package fixtures separate runtime-only and documented test-helper consumers", () => {
  const projectDir = mkdtempSync(join(tmpdir(), "diffgazer-keys-package-fixtures-"));

  try {
    writeKeysPackageModeSmoke(projectDir);
    writeKeysTestHelperSmoke(projectDir);

    const runtimeOnly = readFileSync(join(projectDir, "runtime-only.mjs"), "utf8");
    const helperTest = readFileSync(join(projectDir, "helper-import.test.mjs"), "utf8");

    assert.match(runtimeOnly, /Expected optional test peer/);
    assert.match(runtimeOnly, /await import\('@diffgazer\/keys'\)/);
    assert.doesNotMatch(runtimeOnly, /testing\/navigation-behavior/);
    assert.match(helperTest, /from '@diffgazer\/keys\/testing\/navigation-behavior'/);
    assert.match(helperTest, /from 'vitest'/);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});
