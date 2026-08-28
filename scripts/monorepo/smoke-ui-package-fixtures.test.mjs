import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  collectUiComponentImports,
  writeUiNextPackageSmoke,
} from "./smoke-ui-package-fixtures.mjs";

const exceptionalClientEntries = [
  ["CodeBlockHighlight", "codeBlockHighlight", "@diffgazer/ui/components/code-block/highlight"],
  [
    "CommandPaletteHighlightItem",
    "commandPaletteHighlightItem",
    "@diffgazer/ui/components/command-palette/highlight",
  ],
];

// `clientCrossing` is the construct that forces the directive — a render-function child or a
// JSX event handler. `null` means the example hands no function to a component, so it must stay
// pasteable as a server module: the directive would be dead weight in the consumer's tree.
const copiedExamples = [
  { name: "button-render-prop", clientCrossing: /children|Render-prop link/ },
  { name: "breadcrumbs-custom-link", clientCrossing: /\{\(props\) =>/ },
  { name: "card-interactive", clientCrossing: null },
  { name: "dialog-custom-trigger", clientCrossing: /\{\(triggerProps\) =>/ },
  { name: "overflow-avatars", clientCrossing: /indicator=\{\(\{ count \}\) =>/ },
  { name: "overflow-items", clientCrossing: /indicator=\{\(\{ count \}\) =>/ },
  { name: "pager-render-prop", clientCrossing: /\{\(\{ className/ },
  { name: "popover-basic", clientCrossing: /\{\(triggerProps\) =>/ },
  { name: "popover-placement", clientCrossing: /\{\(triggerProps\) =>/ },
];

function withNextFixture(run) {
  const projectDir = mkdtempSync(join(tmpdir(), "diffgazer-ui-next-fixture-"));

  try {
    writeUiNextPackageSmoke(resolve(import.meta.dirname, "../.."), projectDir);
    run({
      projectDir,
      page: readFileSync(join(projectDir, "app/page.tsx"), "utf8"),
      clientBoundary: readFileSync(join(projectDir, "app/highlight-client-boundaries.tsx"), "utf8"),
    });
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
}

test("Next package fixture keeps the page a Server Component behind one client boundary", () => {
  withNextFixture(({ page, clientBoundary }) => {
    assert.doesNotMatch(page, /^["']use client["'];/m);
    assert.match(clientBoundary, /^"use client";/);
    assert.doesNotMatch(clientBoundary, /defaultOpen/);
    assert.match(
      clientBoundary,
      /<CommandPalette open>[\s\S]*<CommandPalette\.Content>[\s\S]*<CommandPalette\.List>[\s\S]*<CommandPaletteHighlightItem\b/,
    );
  });
});

test("Next package fixture hands both exceptional client entries across the RSC boundary", () => {
  withNextFixture(({ page, clientBoundary }) => {
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
  });
});

test("copied examples keep their directive policy, route wrapper, and UI stubs", () => {
  withNextFixture(({ projectDir }) => {
    for (const { name, clientCrossing } of copiedExamples) {
      const source = readFileSync(join(projectDir, `src/examples/${name}.tsx`), "utf8");
      const route = readFileSync(join(projectDir, `app/copied-examples/${name}/page.tsx`), "utf8");

      if (clientCrossing) {
        assert.match(source, /^"use client";/);
        assert.match(source, clientCrossing);
      } else {
        assert.doesNotMatch(source, /^["']use client["'];/m);
      }
      assert.doesNotMatch(route, /^["']use client["'];/m);
      assert.match(route, new RegExp(`import Example from ['"]@/examples/${name}['"]`));
      assert.match(route, /return <Example \/>;/);

      for (const subpath of collectUiComponentImports(source)) {
        const stubPath = join(projectDir, `src/components/ui/${subpath}.ts`);
        assert.ok(
          existsSync(stubPath),
          `Missing UI stub for @/components/ui/${subpath} required by ${name}`,
        );
        assert.equal(
          readFileSync(stubPath, "utf8").trim(),
          `export * from '@diffgazer/ui/components/${subpath}';`,
          `UI stub for ${subpath} must re-export @diffgazer/ui/components/${subpath}`,
        );
      }
    }
  });
});
