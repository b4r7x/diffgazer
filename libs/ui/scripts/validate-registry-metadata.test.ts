import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(testDir, "validate-registry-metadata.ts");
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
    // keys is a plain required peer here so the keys invariant stays silent; this
    // fixture exercises the unrelated metadata violations asserted below.
    peerDependencies: { "@diffgazer/keys": ">=0.2.0" },
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

// Shared exports block for the keys-peer fixtures below: keyboard-widget is a
// public item that depends on keys hooks, so the keys required-peer invariant
// applies. The only difference between the fixtures is the keys peer metadata.
function keysFixtureExports() {
  return {
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
  };
}

function createKeysPeerFixture(packageJson: Record<string, unknown>) {
  fixtureRoot = mkdtempSync(resolve(tmpdir(), "dg-ui-registry-"));
  mkdirSync(resolve(fixtureRoot, "registry"), { recursive: true });

  writeJson(resolve(fixtureRoot, "registry/registry.json"), {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    items: registryItems(),
  });

  writeJson(resolve(fixtureRoot, "package.json"), {
    sideEffects: ["**/*.css"],
    exports: keysFixtureExports(),
    ...packageJson,
  });

  writeFixtureSources(fixtureRoot);

  return fixtureRoot;
}

// keys declared as a plain required peer (present, not flagged optional) — the
// T-608/F-234 contract. The validator must accept this.
function createKeysRequiredPeerFixture() {
  return createKeysPeerFixture({
    peerDependencies: { "@diffgazer/keys": ">=0.2.0" },
  });
}

// keys re-flagged optional in peerDependenciesMeta — a regression of the old
// contract. The validator must reject this.
function createKeysOptionalFlagFixture() {
  return createKeysPeerFixture({
    peerDependencies: { "@diffgazer/keys": ">=0.2.0" },
    peerDependenciesMeta: { "@diffgazer/keys": { optional: true } },
  });
}

// keys dropped from peerDependencies entirely — package-mode consumers would get
// no signal to install it. The validator must reject this.
function createKeysMissingPeerFixture() {
  return createKeysPeerFixture({
    peerDependencies: {},
  });
}

function runValidator(root: string) {
  try {
    return execFileSync(process.execPath, ["--import", "tsx", scriptPath], {
      encoding: "utf8",
      env: { ...process.env, DIFFGAZER_UI_REGISTRY_ROOT: root },
      stdio: ["ignore", "pipe", "pipe"],
    });
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

  it("accepts a public keys-backed item when keys is a plain required peer", () => {
    const output = runValidator(createKeysRequiredPeerFixture());

    expect(output).not.toContain('peerDependencies must declare "@diffgazer/keys"');
    expect(output).not.toContain('peerDependenciesMeta["@diffgazer/keys"].optional must not be true');
  });

  it("rejects re-flagging the keys peer optional when a public item imports keys hooks", () => {
    const output = runValidator(createKeysOptionalFlagFixture());

    expect(output).toContain(
      'peerDependenciesMeta["@diffgazer/keys"].optional must not be true',
    );
  });

  it("rejects dropping keys from peerDependencies when a public item imports keys hooks", () => {
    const output = runValidator(createKeysMissingPeerFixture());

    expect(output).toContain(
      'package.json peerDependencies must declare "@diffgazer/keys"',
    );
  });
});
