#!/usr/bin/env node

// Do not swap throws for process.exit(): that bypasses the try/finally cleanup and leaks the registry server and fixture dirs.

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENV } from "./lib/env.mjs";
import {
  assertFixtureBuilds,
  assertInstalledRegistryTree,
  assertKeysEntryHooksBundled,
  assertThemeFilesInstalled,
  writeShadcnFixture,
  writeSoloButtonApp,
} from "./smoke-shadcn-install/fixture.mjs";
import {
  addonSideEffectImports,
  allRegistryIndexNames,
  assertAllPublicItemsInstalled,
  assertCrossRegistryTargetsExist,
  assertDirectRegistryDependencies,
  assertKeysTargets,
  assertNoJsImportSpecifiers,
  assertRegistryClosure,
  assertRegistryItemsExist,
  directlyInstallableUiNames,
  keysInstallItems,
  keysItems,
  standaloneKeysHookImports,
  uiComponentNames,
  uiItems,
} from "./smoke-shadcn-install/registry.mjs";
import { startRegistryServer } from "./smoke-shadcn-install/server.mjs";
import { runArgv } from "./smoke-shared/command.mjs";
import { installViteFixtureDeps, resolveLocalDependency } from "./smoke-shared/dependencies.mjs";
import { assertBuiltCss, joinLines, writeViteFixture } from "./smoke-shared/fixtures.mjs";

const root = process.cwd();
const rootPackageManager = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf-8"),
).packageManager;

async function runShadcnAdd(fixture, items, options = {}) {
  const override = process.env[ENV.shadcnCommand];
  const addArgs = ["add", ...items, "--cwd", fixture, "--yes", "--overwrite"];
  const runOptions = {
    cwd: root,
    env: { [ENV.ci]: "1" },
    timeoutMs: options.timeoutMs ?? 180_000,
  };

  if (override) {
    await runArgv(override, addArgs, runOptions);
    return;
  }

  const localBin = resolveLocalShadcnBin();
  if (!localBin) {
    throw new Error(
      "shadcn binary not found in root, libs/ui, or libs/keys node_modules. Run `pnpm install` so the smoke executes the lockfile-pinned shadcn instead of an unpinned `pnpm dlx` download.",
    );
  }
  await runArgv(localBin, addArgs, runOptions);
}

function resolveLocalShadcnBin() {
  for (const dir of [root, resolve(root, "libs/ui"), resolve(root, "libs/keys")]) {
    const bin = resolve(dir, "node_modules/.bin/shadcn");
    if (existsSync(bin)) return realpathSync(bin);
  }
  return null;
}

// F-235 regression: shadcn's destination resolver flattens no-target
// `registry:ui` files to their basename whenever the `ui` alias's trailing
// path segment isn't literally "ui" (it keys off that segment, not the item
// name), collapsing the whole sidebar tree into one directory so every
// cross-folder relative import and every component `index.ts` collides. The
// public UI registry pins an `@ui/<subpath>` target on every `registry:ui`
// file, so shadcn resolves each within the configured ui alias root and
// preserves the component subtree under any alias.
const SIDEBAR_ALIAS_UI_TARGET = "@/app/interface/components";
const SIDEBAR_ALIAS_INSTALL_DIR = "src/app/interface/components";

async function writeSidebarAliasFixture(fixture) {
  writeViteFixture(fixture, {
    name: "shadcn-smoke-sidebar-alias",
    packageManager: rootPackageManager,
    withLibUtils: true,
    indexCss: ['@import "tailwindcss";', '@import "../styles/styles.css";', '@source ".";', ""],
    componentsJson: true,
    uiAlias: SIDEBAR_ALIAS_UI_TARGET,
  });
  await installViteFixtureDeps(root, fixture);
}

function assertSidebarTreeColocated(fixture) {
  const installDir = resolve(fixture, SIDEBAR_ALIAS_INSTALL_DIR);

  // The sidebar item's own parts plus its co-installed `sidebar-variants` and
  // `sidebar-intent` helper items must land in the preserved `sidebar/`
  // subdirectory so sidebar.tsx's `./sidebar-variants` sibling imports resolve;
  // the transitive `dialog` and `icons` deps must keep their own subdirectories
  // too, proving the `@ui/` targets preserve the whole `registry:ui` closure and
  // not just the sidebar item.
  const preserved = [
    "sidebar/index.ts",
    "sidebar/sidebar.tsx",
    "sidebar/sidebar-context.tsx",
    "sidebar/sidebar-item.tsx",
    "sidebar/sidebar-variants.ts",
    "sidebar/sidebar-intent.ts",
    "dialog/dialog.tsx",
    "icons/chevron.tsx",
  ];
  for (const file of preserved) {
    if (!existsSync(resolve(installDir, file))) {
      throw new Error(
        `Expected ${file} under the ${SIDEBAR_ALIAS_UI_TARGET} alias install dir, found nothing at ${resolve(installDir, file)}`,
      );
    }
  }

  // The regression is a flattened tree: without the `@ui/` targets shadcn would
  // collapse sidebar.tsx onto the alias root and pile every component's index.ts
  // onto one file. A flat sidebar.tsx is the tell that the fix regressed.
  const flattened = resolve(installDir, "sidebar.tsx");
  if (existsSync(flattened)) {
    throw new Error(
      `sidebar.tsx was flattened onto the ${SIDEBAR_ALIAS_UI_TARGET} alias root (${flattened}); the @ui/ targets must preserve the sidebar/ subdirectory`,
    );
  }
}

function writeSidebarAliasApp(fixture) {
  writeFileSync(
    resolve(fixture, "src/main.tsx"),
    joinLines(
      "import React from 'react';",
      "import { createRoot } from 'react-dom/client';",
      `import { Sidebar } from '${SIDEBAR_ALIAS_UI_TARGET}/sidebar';`,
      "import './index.css';",
      "",
      "function App() {",
      "  return (",
      '    <main className="min-h-screen bg-background text-foreground p-6">',
      "      <Sidebar>Sidebar</Sidebar>",
      "    </main>",
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ),
  );
}

async function runSmoke() {
  const uiRegistryDir = resolve(root, "libs/ui/public/r");
  const keysRegistryDir = resolve(root, "libs/keys/public/r");

  if (!existsSync(join(uiRegistryDir, "registry.json"))) {
    throw new Error("UI public registry not found. Run build:shadcn first.");
  }
  if (!existsSync(join(keysRegistryDir, "registry.json"))) {
    throw new Error("Keys public registry not found. Run build:shadcn first.");
  }

  assertRegistryItemsExist(keysRegistryDir, keysItems, "Keys");
  assertRegistryItemsExist(uiRegistryDir, uiItems, "UI");
  console.log("OK: all representative registry items exist");

  const allUiNames = allRegistryIndexNames(uiRegistryDir);
  const allKeysNames = allRegistryIndexNames(keysRegistryDir);
  const installableUiNames = directlyInstallableUiNames(uiRegistryDir);

  assertKeysTargets(keysRegistryDir, allKeysNames);
  console.log("OK: keys items have target fields on all files");

  assertNoJsImportSpecifiers(keysRegistryDir, allKeysNames);
  console.log("OK: keys public registry has no .js import specifiers");

  assertDirectRegistryDependencies(uiRegistryDir, allUiNames, "UI");
  console.log("OK: UI public registry dependencies are direct URL ready");

  assertCrossRegistryTargetsExist(uiRegistryDir, allUiNames, keysRegistryDir, "UI");
  console.log("OK: UI registry keys URL dependencies point at existing keys items");

  const registryDirs = new Map([
    ["ui", uiRegistryDir],
    ["keys", keysRegistryDir],
  ]);
  const closureRoots = [
    ...installableUiNames.map((name) => `https://r.b4r7.dev/r/ui/${name}.json`),
    ...allKeysNames.map((name) => `https://r.b4r7.dev/r/keys/${name}.json`),
  ];
  assertRegistryClosure(registryDirs, closureRoots, "public");
  console.log("OK: all public registry items resolve their full dependency closure");

  const registryServer = await startRegistryServer(uiRegistryDir, keysRegistryDir);
  const directFixture = mkdtempSync(join(tmpdir(), "shadcn-smoke-direct-"));
  const namespaceFixture = mkdtempSync(join(tmpdir(), "shadcn-smoke-namespace-"));
  const soloFixture = mkdtempSync(join(tmpdir(), "shadcn-smoke-solo-"));
  const sidebarAliasFixture = mkdtempSync(join(tmpdir(), "shadcn-smoke-sidebar-alias-"));

  try {
    // Install EVERY directly-installable public item through direct registry URLs, not a subset: a static
    // closure resolving is not the same as `shadcn add` writing files and rewriting imports.
    await writeShadcnFixture(directFixture, registryServer.baseUrl, root, rootPackageManager);
    // The leaf add-ons import optional peers (figlet, lowlight); seed them so the installed source builds.
    await runArgv(
      "pnpm",
      [
        "add",
        "--offline",
        "--fetch-retries=0",
        resolveLocalDependency(root, "figlet"),
        resolveLocalDependency(root, "lowlight"),
      ],
      directFixture,
    );
    await runShadcnAdd(
      directFixture,
      installableUiNames.map((name) => `${registryServer.baseUrl}/ui/${name}.json`),
      { timeoutMs: 600_000 },
    );
    console.log(
      "OK: shadcn CLI installed all public UI items and transitive keys through direct local registry URLs",
    );

    await runShadcnAdd(
      directFixture,
      allKeysNames.map((name) => `${registryServer.baseUrl}/keys/${name}.json`),
    );
    console.log(
      "OK: shadcn CLI installed all public keys items through direct local registry URLs",
    );
    assertAllPublicItemsInstalled(directFixture, uiRegistryDir, installableUiNames, "UI");
    assertAllPublicItemsInstalled(directFixture, keysRegistryDir, allKeysNames, "Keys");
    console.log("OK: every public item wrote its declared files through direct install");
    assertInstalledRegistryTree(directFixture);

    // The namespace fixture only proves shadcn's registry-namespace alias resolves and installs the tree.
    // It drives the representative uiItems subset — the direct-URL path above already builds every item
    // exhaustively, so re-running the full build through aliases would double the heaviest work for no signal.
    await writeShadcnFixture(namespaceFixture, registryServer.baseUrl, root, rootPackageManager);
    await runShadcnAdd(
      namespaceFixture,
      uiItems.map((name) => `@ui/${name}`),
    );
    console.log("OK: shadcn CLI installed UI items through local namespace registries");

    await runShadcnAdd(
      namespaceFixture,
      keysInstallItems.map((name) => `@diffgazer-keys/${name}`),
    );
    console.log("OK: shadcn CLI installed keys items through local namespace registries");
    assertInstalledRegistryTree(namespaceFixture);

    console.log("OK: shadcn CLI resolved UI and keys registry dependency trees");

    const leafAddonNames = installableUiNames.filter((name) => !allUiNames.includes(name));
    await assertFixtureBuilds(
      directFixture,
      "Built direct shadcn",
      uiComponentNames(uiRegistryDir, allUiNames),
      [
        ...addonSideEffectImports(uiRegistryDir, leafAddonNames),
        ...standaloneKeysHookImports(keysRegistryDir, allKeysNames, uiRegistryDir),
      ],
    );
    console.log("OK: shadcn direct URL install bundles every UI component, type-checks and builds");

    assertKeysEntryHooksBundled(directFixture, keysRegistryDir, allKeysNames);
    console.log(
      "OK: every installed keys entry hook enters the direct build graph (standalone hooks side-effect imported)",
    );

    await assertFixtureBuilds(
      namespaceFixture,
      "Built namespace shadcn",
      uiComponentNames(uiRegistryDir, uiItems),
    );
    console.log("OK: shadcn direct namespace install type-checks and builds");

    // NEW-017 regression: a single-component install must transitively pull the theme item, or component
    // class names reference tokens that resolve to nothing and the build is unstyled.
    await writeShadcnFixture(soloFixture, registryServer.baseUrl, root, rootPackageManager);
    await runShadcnAdd(soloFixture, [`${registryServer.baseUrl}/ui/button.json`]);
    assertThemeFilesInstalled(soloFixture);
    console.log("OK: solo button install auto-pulled theme via registryDependencies");

    writeSoloButtonApp(soloFixture);
    await runArgv("pnpm", ["run", "typecheck"], soloFixture);
    await runArgv("pnpm", ["run", "build"], soloFixture);
    assertBuiltCss(soloFixture, {
      label: "Built solo button shadcn",
      // Dialog isn't part of solo install — only assert theme tokens reach final CSS.
      expected: [".bg-primary", "--base-bg"],
    });
    console.log("OK: solo button install type-checks and builds with auto-installed theme");

    // F-235 regression: under a real `shadcn add`, the sidebar tree must preserve
    // its component subdirectories when the configured `ui` alias's trailing
    // segment is not literally "ui", so its cross-folder relative imports resolve
    // and the tree type-checks and builds.
    await writeSidebarAliasFixture(sidebarAliasFixture);
    await runShadcnAdd(sidebarAliasFixture, [`${registryServer.baseUrl}/ui/sidebar.json`]);
    assertSidebarTreeColocated(sidebarAliasFixture);
    writeSidebarAliasApp(sidebarAliasFixture);
    await runArgv("pnpm", ["run", "typecheck"], sidebarAliasFixture);
    await runArgv("pnpm", ["run", "build"], sidebarAliasFixture);
    console.log(
      `OK: the sidebar tree preserves its subdirectories under the ${SIDEBAR_ALIAS_UI_TARGET} alias`,
    );
  } finally {
    await registryServer.close();
    rmSync(directFixture, { recursive: true, force: true });
    rmSync(namespaceFixture, { recursive: true, force: true });
    rmSync(soloFixture, { recursive: true, force: true });
    rmSync(sidebarAliasFixture, { recursive: true, force: true });
  }

  console.log("OK: shadcn direct-install smoke passed");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runSmoke();
}
