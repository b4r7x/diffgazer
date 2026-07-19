#!/usr/bin/env node

// Exit-code contract: this smoke runner exits non-zero when a check fails. A
// failed assertion throws, which Node surfaces as a non-zero exit; temp-dir
// cleanup runs in the try/finally blocks around each fixture before the throw
// propagates. Do not swap the throws for process.exit() — that would bypass the
// finally cleanup and leak fixture directories.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn as spawnPty } from "node-pty";
import stripAnsi from "strip-ansi";
import { stringify as stringifyYaml } from "yaml";
import {
  assertBuiltCss,
  CommandFailedError,
  declareTailwindV4Dependency,
  installViteFixtureDeps,
  joinLines,
  networkAllowed,
  packageNameFromSpec,
  packWorkspacePackage,
  pnpmAddFlags,
  resolveAndCollectMissing,
  resolveLocalDependency as resolveWorkspaceDependency,
  runArgv,
  skipMissingSmokeDeps,
  uiSmokeAppBody,
  writeNextFixture,
  writeViteFixture,
} from "./smoke-shared.mjs";

const root = process.cwd();
const dgaddBin = resolve(root, "cli/add/dist/index.js");
const diffgazerBin = resolve(root, "cli/diffgazer/dist/index.js");
const rootPackageManager = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf-8"),
).packageManager;
const TUI_BOOT_TIMEOUT_MS = 30_000;
const TUI_EXIT_TIMEOUT_MS = 10_000;

if (!existsSync(diffgazerBin)) {
  throw new Error(
    `diffgazer CLI not built at ${diffgazerBin}; run pnpm --filter diffgazer build before smoke:cli`,
  );
}

async function runFailureArgv(command, args, cwd = root) {
  try {
    const output = await runArgv(command, args, cwd);
    throw new Error(
      `Expected command to fail but it succeeded: ${command} ${args.join(" ")}\n${output.slice(0, 250)}`,
    );
  } catch (err) {
    if (!(err instanceof CommandFailedError)) {
      throw err;
    }

    return err.output;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function missingLocalDeps(deps) {
  return resolveAndCollectMissing(deps, (dep) => resolveWorkspaceDependency(root, dep));
}

async function runTuiBootSmoke() {
  let output = "";

  await new Promise((resolvePromise, rejectPromise) => {
    let sawBootFrame = false;
    let exitTimer;
    const terminal = spawnPty(process.execPath, [diffgazerBin, "--tui"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: root,
      env: { ...process.env, NO_COLOR: "1", TERM: "xterm-256color" },
    });

    const bootTimer = setTimeout(() => {
      terminal.kill();
      rejectPromise(
        new Error(
          `TUI did not render its home or size gate within ${TUI_BOOT_TIMEOUT_MS}ms:\n${stripAnsi(output).slice(-1_000)}`,
        ),
      );
    }, TUI_BOOT_TIMEOUT_MS);

    terminal.onData((data) => {
      output = `${output}${data}`.slice(-64_000);
      if (sawBootFrame || !/(Main Menu|Terminal too small)/.test(stripAnsi(output))) return;

      sawBootFrame = true;
      clearTimeout(bootTimer);
      terminal.write("q");
      exitTimer = setTimeout(() => {
        terminal.kill();
        rejectPromise(
          new Error(
            `TUI did not exit after q within ${TUI_EXIT_TIMEOUT_MS}ms:\n${stripAnsi(output).slice(-1_000)}`,
          ),
        );
      }, TUI_EXIT_TIMEOUT_MS);
    });

    terminal.onExit(({ exitCode, signal }) => {
      clearTimeout(bootTimer);
      clearTimeout(exitTimer);
      if (!sawBootFrame) {
        rejectPromise(
          new Error(
            `TUI exited before rendering its home or size gate:\n${stripAnsi(output).slice(-1_000)}`,
          ),
        );
        return;
      }
      if (exitCode !== 0) {
        rejectPromise(new Error(`TUI exited with code ${exitCode} and signal ${signal}`));
        return;
      }
      resolvePromise();
    });
  });

  console.log("OK: diffgazer --tui boots in an 80x24 pseudo-terminal and exits with q");
}

async function installDeps(fixture, depSpecs) {
  const deps = networkAllowed()
    ? depSpecs
    : depSpecs.map((dep) => resolveWorkspaceDependency(root, packageNameFromSpec(dep) ?? dep));
  await runArgv("pnpm", ["add", ...pnpmAddFlags(), ...deps], fixture);
  if (depSpecs.some((dep) => packageNameFromSpec(dep) === "tailwindcss")) {
    declareTailwindV4Dependency(fixture);
  }
}

function writeNextCopyFirstApp(fixture) {
  writeFileSync(
    join(fixture, "app/globals.css"),
    joinLines(
      '@import "tailwindcss";',
      '@import "../src/styles/styles.css";',
      '@source "../src";',
      "",
    ),
  );
  writeFileSync(
    join(fixture, "app/layout.tsx"),
    joinLines(
      "import './globals.css';",
      "import type { ReactNode } from 'react';",
      "",
      "export default function RootLayout({ children }: { children: ReactNode }) {",
      '  return <html lang="en"><body>{children}</body></html>;',
      "}",
      "",
    ),
  );
  writeFileSync(
    join(fixture, "app/page.tsx"),
    joinLines(
      "'use client';",
      "",
      "import { Button } from '@/components/ui/button';",
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogCloseIcon } from '@/components/ui/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      "",
      "export default function Page() {",
      "  return (",
      ...uiSmokeAppBody("Copy"),
      "  );",
      "}",
      "",
    ),
  );
}

function writeCopyFirstApp(fixture) {
  writeFileSync(
    join(fixture, "src/index.css"),
    joinLines('@import "tailwindcss";', '@import "./styles/styles.css";', '@source ".";', ""),
  );
  writeFileSync(
    join(fixture, "src/main.tsx"),
    joinLines(
      "import React, { useRef } from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import { Button } from '@/components/ui/button';",
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogCloseIcon } from '@/components/ui/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      // Exercise the rewritten copy-mode hook: in copy mode dgadd rewrites
      // keys/navigation's `@diffgazer/keys` imports to this local path. Importing
      // and calling it proves the rewrite produces a consumable hook, not just a
      // file that happens to type-check unused.
      "import { useNavigation } from '@/hooks/use-navigation';",
      "import './index.css';",
      "",
      "function App() {",
      "  const containerRef = useRef<HTMLDivElement>(null);",
      "  useNavigation({ containerRef, role: 'option' });",
      "  return (",
      ...uiSmokeAppBody("Copy"),
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ),
  );
}

function writeKeysPackageSelectApp(fixture) {
  writeFileSync(
    join(fixture, "src/main.tsx"),
    joinLines(
      "import React from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      "",
      "function App() {",
      "  return (",
      '    <Select defaultOpen defaultValue="main" width="md">',
      '      <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>',
      "      <SelectContent>",
      '        <SelectItem value="main">main</SelectItem>',
      '        <SelectItem value="develop">develop</SelectItem>',
      "      </SelectContent>",
      "    </Select>",
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ),
  );
}

function assertCopyFirstCssInstall(fixture) {
  const dialogShellPath = join(fixture, "src/components/ui/shared/dialog-shell.tsx");
  const dialogShell = readFileSync(dialogShellPath, "utf-8");
  const styles = readFileSync(join(fixture, "src/styles/styles.css"), "utf-8");

  if (/\.css["']/.test(dialogShell)) {
    throw new Error("Copy-first dialog shell still imports component-level global CSS");
  }
  if (existsSync(join(fixture, "src/components/ui/shared/dialog.css"))) {
    throw new Error(
      "Copy-first dialog CSS should be aggregated into src/styles/styles.css, not copied as a component file",
    );
  }
  if (!styles.includes("dialog::backdrop")) {
    throw new Error("Copy-first styles.css does not include dialog global CSS");
  }
}

async function runOptionalNextCopyFirstSmoke() {
  const nextDeps = [
    "react@^19.2.0",
    "react-dom@^19.2.0",
    "@types/react@^19.2.0",
    "@types/react-dom@^19.2.0",
    "@types/node@^22.10.0",
    "typescript@^5.9.0",
    "next@^16.2.0",
    "tailwindcss@^4.1.0",
    "@tailwindcss/postcss@^4.1.0",
    "postcss@^8.5.0",
    "class-variance-authority@^0.7.1",
    "clsx@^2.1.1",
    "tailwind-merge@^3.4.0",
  ];

  if (!networkAllowed()) {
    const missing = missingLocalDeps(
      nextDeps.map((dep) => packageNameFromSpec(dep)).filter(Boolean),
    );
    if (skipMissingSmokeDeps("dgadd Next copy-first build", missing)) {
      return;
    }
  }

  const fixture = mkdtempSync(join(tmpdir(), "dgadd-next-smoke-"));
  try {
    writeNextFixture(fixture, { root, withSrc: true, paths: true });
    await installDeps(fixture, nextDeps);
    await runArgv("node", [dgaddBin, "init", "--cwd", fixture, "--yes", "--skip-install"]);
    await runArgv("node", [
      dgaddBin,
      "add",
      "ui/button",
      "ui/dialog",
      "ui/select",
      "ui/form-reset",
      "--cwd",
      fixture,
      "--yes",
      "--skip-install",
    ]);
    assertCopyFirstCssInstall(fixture);
    writeNextCopyFirstApp(fixture);
    await runArgv("pnpm", ["exec", "next", "build", "--webpack"], fixture);
    assertBuiltCss(fixture, { outputDir: ".next", label: "Built copy-first" });
    console.log("OK: dgadd Next copy-first build flow");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

const diffgazerPackage = JSON.parse(
  readFileSync(resolve(root, "cli/diffgazer/package.json"), "utf-8"),
);

const commands = [
  {
    name: "diffgazer --help",
    command: "node",
    args: [diffgazerBin, "--help"],
    expect: /--tui\s+Start the terminal UI/i,
    label: "product CLI help",
  },
  {
    name: "diffgazer --version",
    command: "node",
    args: [diffgazerBin, "--version"],
    expect: new RegExp(`^${escapeRegExp(diffgazerPackage.version)}\\s*$`),
    label: "product CLI version",
  },
  {
    name: "diffgazer --theme without --tui",
    command: "node",
    args: [diffgazerBin, "--theme", "classic"],
    expect: /--theme requires --tui\./,
    label: "product CLI rejects TUI-only theme",
    expectFailure: true,
  },
  {
    name: "dgadd --help",
    command: "node",
    args: [dgaddBin, "--help"],
    expect: /help|Usage|add/i,
    label: "installer CLI help",
  },
  {
    name: "dgadd ui item",
    command: "node",
    args: [dgaddBin, "add", "--help"],
    expect: /ui\/\*|ui/i,
    label: "installer ui namespace",
  },
  {
    name: "dgadd keys item",
    command: "node",
    args: [dgaddBin, "add", "--help"],
    expect: /keys\/\*|keys/i,
    label: "installer keys namespace",
  },
];

for (const check of commands) {
  const output = check.expectFailure
    ? await runFailureArgv(check.command, check.args)
    : await runArgv(check.command, check.args);

  if (!check.expect.test(output)) {
    throw new Error(
      `Smoke check failed for ${check.label}: expected ${check.expect}, got ${output.slice(0, 250)}`,
    );
  }

  console.log(`OK: ${check.name}`);
}

await runTuiBootSmoke();

const fixture = mkdtempSync(join(tmpdir(), "dgadd-smoke-"));
try {
  writeViteFixture(fixture);
  await installViteFixtureDeps(root, fixture);

  await runArgv("node", [dgaddBin, "init", "--cwd", fixture, "--yes", "--skip-install"]);
  await runArgv("node", [
    dgaddBin,
    "add",
    "ui/button",
    "ui/dialog",
    "ui/select",
    "ui/checkbox",
    "ui/radio",
    "ui/toggle-group",
    "ui/form-reset",
    "keys/navigation",
    "--cwd",
    fixture,
    "--yes",
    "--skip-install",
  ]);
  assertCopyFirstCssInstall(fixture);
  if (!existsSync(join(fixture, "src/lib/selectable-collection.ts"))) {
    throw new Error("selectable-collection helper was not copied for selectable UI components");
  }
  writeCopyFirstApp(fixture);
  await runArgv("node", [dgaddBin, "list", "--installed", "--json", "--cwd", fixture]);
  await runArgv("node", [dgaddBin, "diff", "--cwd", fixture]);
  await runArgv("pnpm", ["run", "typecheck"], fixture);
  await runArgv("pnpm", ["run", "build"], fixture);
  assertBuiltCss(fixture, { label: "Built copy-first" });
  const removeOutput = await runArgv("node", [
    dgaddBin,
    "remove",
    "keys/navigation",
    "--cwd",
    fixture,
    "--yes",
  ]);

  if (!/Keeping keys\/navigation/.test(removeOutput)) {
    throw new Error(
      `keys/navigation removal was not clearly blocked. Output: ${removeOutput.slice(0, 250)}`,
    );
  }

  const config = JSON.parse(readFileSync(join(fixture, "diffgazer.json"), "utf-8"));
  if (!config.installedComponents?.["keys/navigation"]) {
    throw new Error(
      "keys/navigation manifest entry was removed while copy-mode UI still depends on it",
    );
  }
  if (!existsSync(join(fixture, "src/hooks/use-navigation.ts"))) {
    throw new Error("keys/navigation hook was removed while copy-mode UI still depends on it");
  }
  await runArgv("pnpm", ["run", "typecheck"], fixture);
  await runArgv("pnpm", ["run", "build"], fixture);
  console.log("OK: dgadd copy-first init/add/list/diff/remove typecheck/build flow");
  await runOptionalNextCopyFirstSmoke();
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

async function runInstallDependencySmoke() {
  const fixture = mkdtempSync(join(tmpdir(), "dgadd-install-deps-"));
  try {
    writeViteFixture(fixture);
    const packageJsonPath = join(fixture, "package.json");
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    pkg.packageManager = rootPackageManager;
    const overrides = {
      "class-variance-authority": resolveWorkspaceDependency(root, "class-variance-authority"),
      clsx: resolveWorkspaceDependency(root, "clsx"),
      "tailwind-merge": resolveWorkspaceDependency(root, "tailwind-merge"),
    };
    writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
    writeFileSync(join(fixture, "pnpm-workspace.yaml"), stringifyYaml({ packages: [], overrides }));

    await runArgv("node", [dgaddBin, "init", "--cwd", fixture, "--yes"]);
    await runArgv("node", [dgaddBin, "add", "ui/badge", "--cwd", fixture, "--yes"]);

    const installedPackageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    if (!installedPackageJson.dependencies?.["class-variance-authority"]) {
      throw new Error("dgadd init without --skip-install did not install class-variance-authority");
    }
    if (!installedPackageJson.dependencies?.clsx) {
      throw new Error("dgadd init without --skip-install did not install clsx");
    }
    if (!installedPackageJson.dependencies?.["tailwind-merge"]) {
      throw new Error("dgadd init without --skip-install did not install tailwind-merge");
    }
    if (!existsSync(join(fixture, "src/components/ui/badge/badge.tsx"))) {
      throw new Error("ui/badge was not installed without --skip-install");
    }
    console.log("OK: dgadd add without --skip-install");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

async function runKeysPackageIntegrationSmoke() {
  const fixture = mkdtempSync(join(tmpdir(), "dgadd-keys-dep-"));
  try {
    writeViteFixture(fixture);
    await installViteFixtureDeps(root, fixture);

    await runArgv("node", [dgaddBin, "init", "--cwd", fixture, "--yes", "--skip-install"]);
    await runArgv("node", [
      dgaddBin,
      "add",
      "ui/button",
      "--integration",
      "keys",
      "--cwd",
      fixture,
      "--yes",
      "--skip-install",
    ]);

    const keysDepConfig = JSON.parse(readFileSync(join(fixture, "diffgazer.json"), "utf-8"));
    if (keysDepConfig.installedComponents?.["ui/button"]?.integrationMode === "@diffgazer/keys") {
      throw new Error(
        "button has no keyboard integration but was installed with @diffgazer/keys mode",
      );
    }

    const keysVersionSpec = JSON.parse(
      readFileSync(resolve(root, "libs/keys/package.json"), "utf-8"),
    ).version;
    const keysVersionRange = `^${keysVersionSpec}`;
    const packageJsonPath = join(fixture, "package.json");
    const packDir = join(fixture, "packs");
    mkdirSync(packDir, { recursive: true });
    const keysPackPath = await packWorkspacePackage(root, "@diffgazer/keys", packDir);
    const keysFixturePkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    keysFixturePkg.pnpm = {
      ...(keysFixturePkg.pnpm ?? {}),
      overrides: {
        ...(keysFixturePkg.pnpm?.overrides ?? {}),
        "@diffgazer/keys": `file:${keysPackPath}`,
      },
    };
    writeFileSync(packageJsonPath, `${JSON.stringify(keysFixturePkg, null, 2)}\n`);

    await runArgv("node", [
      dgaddBin,
      "add",
      "ui/select",
      "--integration",
      "keys",
      "--keys-version",
      keysVersionRange,
      "--cwd",
      fixture,
      "--yes",
      "--skip-install",
    ]);

    await runArgv(
      "pnpm",
      ["add", ...pnpmAddFlags(), "--config.auto-install-peers=false", keysPackPath],
      fixture,
    );
    const installedKeysPkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    installedKeysPkg.dependencies = {
      ...installedKeysPkg.dependencies,
      "@diffgazer/keys": keysVersionRange,
    };
    writeFileSync(packageJsonPath, `${JSON.stringify(installedKeysPkg, null, 2)}\n`);
    const keysSelectConfig = JSON.parse(readFileSync(join(fixture, "diffgazer.json"), "utf-8"));
    const selectRecord = keysSelectConfig.installedComponents?.["ui/select"];
    if (selectRecord?.integrationMode !== "@diffgazer/keys") {
      throw new Error(
        `Expected select integrationMode to be "@diffgazer/keys", got "${selectRecord?.integrationMode}"`,
      );
    }
    if (selectRecord?.keysVersion !== keysVersionRange) {
      throw new Error(
        `Expected select keysVersion to be "${keysVersionRange}", got "${selectRecord?.keysVersion}"`,
      );
    }

    const selectContentPath = join(fixture, "src/components/ui/select/select-content.tsx");
    const selectContent = readFileSync(selectContentPath, "utf-8");
    if (!selectContent.includes("@diffgazer/keys")) {
      throw new Error("select-content.tsx does not contain @diffgazer/keys import in keys mode");
    }
    if (selectContent.includes("@/hooks/use-navigation")) {
      throw new Error("select-content.tsx still references @/hooks/use-navigation in keys mode");
    }
    const keysDepPackage = JSON.parse(readFileSync(join(fixture, "package.json"), "utf-8"));
    if (keysDepPackage.dependencies?.["@diffgazer/keys"] !== keysVersionRange) {
      throw new Error(
        `ui/select --integration keys did not record @diffgazer/keys@${keysVersionRange} in package.json`,
      );
    }
    if (existsSync(join(fixture, "src/hooks/use-navigation.ts"))) {
      throw new Error("keys package mode should not copy local use-navigation.ts");
    }
    writeKeysPackageSelectApp(fixture);
    await runArgv("pnpm", ["run", "typecheck"], fixture);
    await runArgv("pnpm", ["run", "build"], fixture);

    console.log("OK: keys package integration dependency install/build flow");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

async function runBareNameRejectionSmoke() {
  const fixture = mkdtempSync(join(tmpdir(), "smoke-bare-"));
  try {
    writeViteFixture(fixture);
    await runArgv("node", [dgaddBin, "init", "--cwd", fixture, "--yes"]);
    const bareOutput = await runFailureArgv("node", [
      dgaddBin,
      "add",
      "button",
      "--cwd",
      fixture,
      "--yes",
      "--skip-install",
    ]);
    if (!/not found|Invalid item name|Use a namespaced name/.test(bareOutput)) {
      throw new Error(`Expected bare name rejection, got: ${bareOutput.slice(0, 250)}`);
    }
    console.log("OK: bare name rejection");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

await runInstallDependencySmoke();
await runKeysPackageIntegrationSmoke();
await runBareNameRejectionSmoke();

console.log("OK: CLI smoke checks passed");
