import { spawnSync } from "node:child_process";
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

// clean=true produces a fixture with no metadata violations, for tests that
// assert a fully successful validator run; clean=false (default) keeps the
// widget-client and keyboard-widget-integration violations that
// createInvalidFixture asserts on below.
function registryItems({ clean = false }: { clean?: boolean } = {}) {
  return [
    {
      name: "widget",
      type: "registry:ui",
      ...(clean ? { meta: { client: true }, registryDependencies: ["helper"] } : {}),
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
      ...(clean ? { meta: { optionalIntegrations: ["keyboard-navigation"] } } : {}),
      files: [{ path: "registry/ui/keyboard-widget/index.tsx" }],
    },
  ];
}

function writeFixtureSources(root: string) {
  writeFile(
    resolve(root, "registry/ui/widget/index.tsx"),
    [
      '"use client";',
      'import { helper } from "@/lib/helper";',
      "export function Widget() { return helper; }",
      "",
    ].join("\n"),
  );
  writeFile(resolve(root, "registry/lib/helper.ts"), "export const helper = 'helper';\n");
  writeFile(resolve(root, "registry/ui/hidden-card/index.ts"), "export const HiddenCard = null;\n");
  writeFile(
    resolve(root, "registry/ui/keyboard-widget/index.tsx"),
    "export const KeyboardWidget = null;\n",
  );
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
    items: registryItems({ clean: true }),
  });

  writeJson(resolve(fixtureRoot, "package.json"), {
    sideEffects: ["**/*.css"],
    exports: keysFixtureExports(),
    ...packageJson,
  });

  writeFixtureSources(fixtureRoot);

  return fixtureRoot;
}

// keys declared as a plain required peer (present, not flagged optional):
// package-mode UI entries import @diffgazer/keys at runtime, so it must remain a
// required peer. The validator must accept this.
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
  const result = spawnSync(process.execPath, ["--import", "tsx", scriptPath], {
    encoding: "utf8",
    env: { ...process.env, DIFFGAZER_UI_REGISTRY_ROOT: root },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function writePublicItem(root: string, content: string, hidden = false) {
  mkdirSync(resolve(root, "public/r"), { recursive: true });
  writeJson(resolve(root, "public/r/keys-leak.json"), {
    name: "keys-leak",
    type: "registry:ui",
    ...(hidden ? { meta: { hidden: true } } : {}),
    files: [{ path: "keys-leak.ts", content }],
  });
}

afterEach(() => {
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
  fixtureRoot = null;
});

describe("validate-registry-metadata", () => {
  it("reports negative fixture metadata violations", () => {
    const { status, stderr } = runValidator(createInvalidFixture());

    expect(status).not.toBe(0);
    expect(stderr).toContain('package export "./components/*" uses a wildcard');
    expect(stderr).toContain('package export ./components/bad-export nests "types" under "import"');
    expect(stderr).toContain(
      "hidden-card is hidden but package.json exposes ./components/hidden-card",
    );
    expect(stderr).toContain("widget contains a client file but omits meta.client");
    expect(stderr).toContain("widget imports @/lib/helper");
    expect(stderr).toContain("package.json sideEffects must preserve CSS exports");

    expect(stderr).toContain(
      "keyboard-widget depends on keys registry hooks but omits meta.optionalIntegrations keyboard-navigation",
    );
  });

  it("accepts a public keys-backed item when keys is a plain required peer", () => {
    const { status, stdout } = runValidator(createKeysRequiredPeerFixture());

    expect(status).toBe(0);
    expect(stdout).toContain("[ui] registry metadata OK");
  });

  it("rejects re-flagging the keys peer optional when a public item imports keys hooks", () => {
    const { status, stderr } = runValidator(createKeysOptionalFlagFixture());

    expect(status).not.toBe(0);
    expect(stderr).toContain('peerDependenciesMeta["@diffgazer/keys"].optional must not be true');
  });

  it("rejects dropping keys from peerDependencies when a public item imports keys hooks", () => {
    const { status, stderr } = runValidator(createKeysMissingPeerFixture());

    expect(status).not.toBe(0);
    expect(stderr).toContain('package.json peerDependencies must declare "@diffgazer/keys"');
  });

  it("rejects every unsupported root keys import form in public copy content", () => {
    const root = createKeysRequiredPeerFixture();
    writePublicItem(
      root,
      [
        'import keys from "@diffgazer/keys";',
        'import * as namespace from "@diffgazer/keys";',
        'import "@diffgazer/keys";',
        'export * from "@diffgazer/keys";',
        'const dynamic = import("@diffgazer/keys");',
        'const required = require("@diffgazer/keys");',
      ].join("\n"),
    );

    const { status, stderr } = runValidator(root);

    expect(status).not.toBe(0);
    expect(stderr).toContain(
      "unsupported @diffgazer/keys root import (import, export, dynamic-import, require, side-effect)",
    );
  });

  it("rejects unsupported root keys imports in hidden public dependencies", () => {
    const root = createKeysRequiredPeerFixture();
    writePublicItem(
      root,
      [
        'import keys from "@diffgazer/keys";',
        'const dynamic = import("@diffgazer/keys");',
        'const required = require("@diffgazer/keys");',
      ].join("\n"),
      true,
    );

    const { status, stderr } = runValidator(root);

    expect(status).not.toBe(0);
    expect(stderr).toContain(
      "unsupported @diffgazer/keys root import (import, dynamic-import, require)",
    );
  });

  it("detects executable template root imports without flagging raw template text", () => {
    const root = createKeysRequiredPeerFixture();
    writePublicItem(
      root,
      [
        "const directDynamic = import(`@diffgazer/keys`);",
        "const directRequired = require(`@diffgazer/keys`);",
        `const interpolated = \`\${import("@diffgazer/keys")}:\${require("@diffgazer/keys")}\`;`,
        'const raw = `import("@diffgazer/keys"); require("@diffgazer/keys");`;',
      ].join("\n"),
    );

    const { status, stderr } = runValidator(root);

    expect(status).not.toBe(0);
    expect(stderr).toContain("unsupported @diffgazer/keys root import (dynamic-import, require)");
  });
});
