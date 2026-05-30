import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(testDir, "../../../scripts/validate-registry-metadata.ts");
let fixtureRoot: string | null = null;

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(path: string, source: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
}

function registryItems() {
  return [
    {
      name: "widget",
      type: "registry:ui",
      files: [{ path: "registry/ui/widget/index.tsx" }],
    },
    {
      name: "helper",
      type: "registry:lib",
      files: [{ path: "registry/lib/helper.ts" }],
    },
    {
      name: "hidden-card",
      type: "registry:ui",
      meta: { hidden: true },
      files: [{ path: "registry/ui/hidden-card/index.ts" }],
    },
    {
      name: "keyboard-widget",
      type: "registry:ui",
      registryDependencies: ["@diffgazer-keys/use-key"],
      files: [{ path: "registry/ui/keyboard-widget/index.tsx" }],
    },
  ];
}

function writeFixtureSources(root: string) {
  writeFile(resolve(root, "registry/ui/widget/index.tsx"), [
    '"use client";',
    'import { helper } from "@/lib/helper";',
    "export function Widget() { return helper; }",
    "",
  ].join("\n"));
  writeFile(resolve(root, "registry/lib/helper.ts"), "export const helper = 'helper';\n");
  writeFile(resolve(root, "registry/ui/hidden-card/index.ts"), "export const HiddenCard = null;\n");
  writeFile(resolve(root, "registry/ui/keyboard-widget/index.tsx"), "export const KeyboardWidget = null;\n");
}

function createInvalidFixture() {
  fixtureRoot = mkdtempSync(resolve(tmpdir(), "dg-ui-registry-"));
  mkdirSync(resolve(fixtureRoot, "registry"), { recursive: true });

  writeJson(resolve(fixtureRoot, "registry/registry.json"), {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    items: registryItems(),
  });

  writeJson(resolve(fixtureRoot, "package.json"), {
    sideEffects: false,
    peerDependenciesMeta: {
      "@diffgazer/keys": { optional: true },
    },
    exports: {
      "./components/*": "./dist/components/*.js",
      "./components/widget": {
        types: "./dist/components/widget.d.ts",
        import: "./dist/components/widget.js",
      },
      "./lib/helper": {
        types: "./dist/lib/helper.d.ts",
        import: "./dist/lib/helper.js",
      },
      "./components/hidden-card": {
        types: "./dist/components/hidden-card.d.ts",
        import: "./dist/components/hidden-card.js",
      },
      "./components/bad-export": {
        import: {
          types: "./dist/components/bad-export.d.ts",
          default: "./dist/components/bad-export.js",
        },
      },
      "./components/keyboard-widget": {
        types: "./dist/components/keyboard-widget.d.ts",
        import: "./dist/components/keyboard-widget.js",
      },
      "./lib/utils": {
        types: "./dist/lib/utils.d.ts",
        import: "./dist/lib/utils.js",
      },
    },
  });

  writeFixtureSources(fixtureRoot);

  return fixtureRoot;
}

function createKeysPeerNotOptionalFixture() {
  fixtureRoot = mkdtempSync(resolve(tmpdir(), "dg-ui-registry-"));
  mkdirSync(resolve(fixtureRoot, "registry"), { recursive: true });

  writeJson(resolve(fixtureRoot, "registry/registry.json"), {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    items: registryItems(),
  });

  writeJson(resolve(fixtureRoot, "package.json"), {
    sideEffects: ["**/*.css"],
    // keyboard-widget is a public item that depends on keys hooks, but the peer is
    // not flagged optional — validateKeysPeerOptionalFlag must reject this.
    peerDependenciesMeta: {
      "@diffgazer/keys": { optional: false },
    },
    exports: {
      "./components/widget": {
        types: "./dist/components/widget.d.ts",
        import: "./dist/components/widget.js",
      },
      "./lib/helper": {
        types: "./dist/lib/helper.d.ts",
        import: "./dist/lib/helper.js",
      },
      "./components/keyboard-widget": {
        types: "./dist/components/keyboard-widget.d.ts",
        import: "./dist/components/keyboard-widget.js",
      },
      "./lib/utils": {
        types: "./dist/lib/utils.d.ts",
        import: "./dist/lib/utils.js",
      },
    },
  });

  writeFixtureSources(fixtureRoot);

  return fixtureRoot;
}

function runValidator(root: string) {
  try {
    execFileSync(process.execPath, ["--import", "tsx", scriptPath], {
      encoding: "utf8",
      env: { ...process.env, DIFFGAZER_UI_REGISTRY_ROOT: root },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return "";
  } catch (error) {
    return String((error as { stderr?: Buffer | string }).stderr ?? error);
  }
}

afterEach(() => {
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
  fixtureRoot = null;
});

describe("validate-registry-metadata", () => {
  it("reports negative fixture metadata violations", () => {
    const output = runValidator(createInvalidFixture());

    expect(output).toContain('package export "./components/*" uses a wildcard');
    expect(output).toContain('package export ./components/bad-export nests "types" under "import"');
    expect(output).toContain("hidden-card is hidden but package.json exposes ./components/hidden-card");
    expect(output).toContain("widget contains a client file but omits meta.client");
    expect(output).toContain("widget imports @/lib/helper");
    expect(output).toContain("package.json sideEffects must preserve CSS exports");

    expect(output).toContain("keyboard-widget depends on keys registry hooks but omits meta.optionalIntegrations keyboard-navigation");
  });

  it("reports when a public keys-backed item leaves the keys peer non-optional", () => {
    const output = runValidator(createKeysPeerNotOptionalFixture());

    expect(output).toContain(
      'peerDependenciesMeta["@diffgazer/keys"].optional must be true',
    );
  });
});
