#!/usr/bin/env node

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
import {
  quoteArgs,
  packageNameFromSpec,
  networkAllowed,
  pnpmAddFlags,
  assertBuiltCss,
  installViteFixtureDeps,
  resolveLocalDependency as resolveWorkspaceDependency,
  run,
  skipMissingSmokeDeps,
  uiSmokeAppBody,
  writeNextFixture,
  writeViteFixture,
} from "./smoke-shared.mjs";

const root = process.cwd();

function runFailure(cmd, cwd = root) {
  try {
    const output = run(cmd, cwd);
    throw new Error(`Expected command to fail but it succeeded: ${cmd}\n${output.slice(0, 250)}`);
  } catch (err) {
    if (!err || typeof err !== "object" || typeof err.status !== "number") {
      throw err;
    }

    return `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function missingLocalDeps(deps) {
  const missing = [];
  for (const dep of deps) {
    try {
      resolveWorkspaceDependency(root, dep);
    } catch {
      missing.push(dep);
    }
  }
  return missing;
}

function installDeps(fixture, depSpecs) {
  const deps = networkAllowed()
    ? depSpecs
    : depSpecs.map((dep) => resolveWorkspaceDependency(root, packageNameFromSpec(dep) ?? dep));
  run(`pnpm add ${pnpmAddFlags().join(" ")} ${quoteArgs(deps)}`, fixture);
}

function writeNextCopyFirstApp(fixture) {
  writeFileSync(
    join(fixture, "app/globals.css"),
    [
      '@import "tailwindcss";',
      '@import "../src/styles/styles.css";',
      '@source "../src";',
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(fixture, "app/layout.tsx"),
    [
      "import './globals.css';",
      "import type { ReactNode } from 'react';",
      "",
      "export default function RootLayout({ children }: { children: ReactNode }) {",
      "  return <html lang=\"en\"><body>{children}</body></html>;",
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(fixture, "app/page.tsx"),
    [
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
    ].join("\n"),
  );
}

function writeCopyFirstApp(fixture) {
  writeFileSync(
    join(fixture, "src/index.css"),
    [
      '@import "tailwindcss";',
      '@import "./styles/styles.css";',
      '@source ".";',
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(fixture, "src/main.tsx"),
    [
      "import React from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import { Button } from '@/components/ui/button';",
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogCloseIcon } from '@/components/ui/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      "import './index.css';",
      "",
      "function App() {",
      "  return (",
      ...uiSmokeAppBody("Copy"),
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ].join("\n"),
  );
}

function writeKeysPackageSelectApp(fixture) {
  writeFileSync(
    join(fixture, "src/main.tsx"),
    [
      "import React from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      "",
      "function App() {",
      "  return (",
      "    <Select defaultOpen defaultValue=\"main\" width=\"md\">",
      "      <SelectTrigger><SelectValue placeholder=\"Branch\" /></SelectTrigger>",
      "      <SelectContent>",
      "        <SelectItem value=\"main\">main</SelectItem>",
      "        <SelectItem value=\"develop\">develop</SelectItem>",
      "      </SelectContent>",
      "    </Select>",
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ].join("\n"),
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
    throw new Error("Copy-first dialog CSS should be aggregated into src/styles/styles.css, not copied as a component file");
  }
  if (!styles.includes("dialog::backdrop")) {
    throw new Error("Copy-first styles.css does not include dialog global CSS");
  }
}

function runOptionalNextCopyFirstSmoke(dgadd) {
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
    installDeps(fixture, nextDeps);
    run(`${dgadd} init --cwd ${JSON.stringify(fixture)} --yes --skip-install`);
    run(`${dgadd} add ui/button ui/dialog ui/select ui/form-reset --cwd ${JSON.stringify(fixture)} --yes --skip-install`);
    assertCopyFirstCssInstall(fixture);
    writeNextCopyFirstApp(fixture);
    run("pnpm exec next build --webpack", fixture);
    assertBuiltCss(fixture, { outputDir: ".next", label: "Built copy-first" });
    console.log("OK: dgadd Next copy-first build flow");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

const diffgazerPackage = JSON.parse(readFileSync(resolve(root, "cli/diffgazer/package.json"), "utf-8"));

const commands = [
  {
    name: "diffgazer --help",
    command: "node cli/diffgazer/dist/index.js --help",
    expect: /--tui[\s\S]*beta terminal UI \(incomplete; not recommended\)/i,
    label: "product CLI help",
    optionalPath: "cli/diffgazer/dist/index.js",
  },
  {
    name: "diffgazer --version",
    command: "node cli/diffgazer/dist/index.js --version",
    expect: new RegExp(`^${escapeRegExp(diffgazerPackage.version)}\\s*$`),
    label: "product CLI version",
    optionalPath: "cli/diffgazer/dist/index.js",
  },
  {
    name: "diffgazer --theme without --tui",
    command: "node cli/diffgazer/dist/index.js --theme classic",
    expect: /--theme requires --tui\./,
    label: "product CLI rejects TUI-only theme",
    optionalPath: "cli/diffgazer/dist/index.js",
    expectFailure: true,
  },
  {
    name: "dgadd --help",
    command: "node cli/add/dist/index.js --help",
    expect: /help|Usage|add/i,
    label: "installer CLI help",
  },
  {
    name: "dgadd ui item",
    command: "node cli/add/dist/index.js add --help",
    expect: /ui\/\*|ui/i,
    label: "installer ui namespace",
  },
  {
    name: "dgadd keys item",
    command: "node cli/add/dist/index.js add --help",
    expect: /keys\/\*|keys/i,
    label: "installer keys namespace",
  },
];

for (const check of commands) {
  if (check.optionalPath && !existsSync(resolve(root, check.optionalPath))) {
    console.log(`SKIP: ${check.name} (${check.optionalPath} not built)`);
    continue;
  }

  const output = check.expectFailure ? runFailure(check.command) : run(check.command);

  if (!check.expect.test(output)) {
    throw new Error(`Smoke check failed for ${check.label}: expected ${check.expect}, got ${output.slice(0, 250)}`);
  }

  console.log(`OK: ${check.name}`);
}

const fixture = mkdtempSync(join(tmpdir(), "dgadd-smoke-"));
try {
  writeViteFixture(fixture);
  installViteFixtureDeps(root, fixture);

  const dgadd = `node ${JSON.stringify(resolve(root, "cli/add/dist/index.js"))}`;
  run(`${dgadd} init --cwd ${JSON.stringify(fixture)} --yes --skip-install`);
  run(`${dgadd} add ui/button ui/dialog ui/select ui/checkbox ui/radio ui/toggle-group ui/form-reset keys/navigation --cwd ${JSON.stringify(fixture)} --yes --skip-install`);
  assertCopyFirstCssInstall(fixture);
  if (!existsSync(join(fixture, "src/lib/selectable-collection.ts"))) {
    throw new Error("selectable-collection helper was not copied for selectable UI components");
  }
  writeCopyFirstApp(fixture);
  run(`${dgadd} list --installed --json --cwd ${JSON.stringify(fixture)}`);
  run(`${dgadd} diff --cwd ${JSON.stringify(fixture)}`);
  run("pnpm run typecheck", fixture);
  run("pnpm run build", fixture);
  assertBuiltCss(fixture, { label: "Built copy-first" });
  const removeOutput = run(`${dgadd} remove keys/navigation --cwd ${JSON.stringify(fixture)} --yes`);

  if (!/Keeping keys\/navigation/.test(removeOutput)) {
    throw new Error(`keys/navigation removal was not clearly blocked. Output: ${removeOutput.slice(0, 250)}`);
  }

  const config = JSON.parse(readFileSync(join(fixture, "diffgazer.json"), "utf-8"));
  if (!config.installedComponents?.["keys/navigation"]) {
    throw new Error("keys/navigation manifest entry was removed while copy-mode UI still depends on it");
  }
  if (!existsSync(join(fixture, "src/hooks/use-navigation.ts"))) {
    throw new Error("keys/navigation hook was removed while copy-mode UI still depends on it");
  }
  run("pnpm run typecheck", fixture);
  run("pnpm run build", fixture);
  console.log("OK: dgadd copy-first init/add/list/diff/remove typecheck/build flow");
  runOptionalNextCopyFirstSmoke(dgadd);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

function runInstallDependencySmoke() {
  const fixture = mkdtempSync(join(tmpdir(), "dgadd-install-deps-"));
  try {
    writeViteFixture(fixture);
    const packageJsonPath = join(fixture, "package.json");
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    pkg.packageManager = "pnpm@10.0.0";
    pkg.pnpm = {
      ...(pkg.pnpm ?? {}),
      overrides: {
        ...(pkg.pnpm?.overrides ?? {}),
        "class-variance-authority": resolveWorkspaceDependency(root, "class-variance-authority"),
        "clsx": resolveWorkspaceDependency(root, "clsx"),
        "tailwind-merge": resolveWorkspaceDependency(root, "tailwind-merge"),
      },
    };
    writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

    const dgaddInstallDeps = `node ${JSON.stringify(resolve(root, "cli/add/dist/index.js"))}`;
    run(`${dgaddInstallDeps} init --cwd ${JSON.stringify(fixture)} --yes`);
    run(`${dgaddInstallDeps} add ui/badge --cwd ${JSON.stringify(fixture)} --yes`);

    const installedPackageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    if (!installedPackageJson.dependencies?.["class-variance-authority"]) {
      throw new Error("dgadd init without --skip-install did not install class-variance-authority");
    }
    if (!installedPackageJson.dependencies?.["clsx"]) {
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

function runKeysPackageIntegrationSmoke() {
  const fixture = mkdtempSync(join(tmpdir(), "dgadd-keys-dep-"));
  try {
    writeViteFixture(fixture);
    installViteFixtureDeps(root, fixture);

    const dgaddKeys = `node ${JSON.stringify(resolve(root, "cli/add/dist/index.js"))}`;
    run(`${dgaddKeys} init --cwd ${JSON.stringify(fixture)} --yes --skip-install`);
    run(`${dgaddKeys} add ui/button --integration keys --cwd ${JSON.stringify(fixture)} --yes --skip-install`);

    const keysDepConfig = JSON.parse(readFileSync(join(fixture, "diffgazer.json"), "utf-8"));
    if (keysDepConfig.installedComponents?.["ui/button"]?.integrationMode === "@diffgazer/keys") {
      throw new Error("button has no keyboard integration but was installed with @diffgazer/keys mode");
    }

    const localKeysVersion = `link:${realpathSync(resolve(root, "libs/keys"))}`;
    run(`${dgaddKeys} add ui/select --integration keys --keys-version ${JSON.stringify(localKeysVersion)} --cwd ${JSON.stringify(fixture)} --yes`);
    const keysSelectConfig = JSON.parse(readFileSync(join(fixture, "diffgazer.json"), "utf-8"));
    const selectRecord = keysSelectConfig.installedComponents?.["ui/select"];
    if (selectRecord?.integrationMode !== "@diffgazer/keys") {
      throw new Error(`Expected select integrationMode to be "@diffgazer/keys", got "${selectRecord?.integrationMode}"`);
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
    if (keysDepPackage.dependencies?.["@diffgazer/keys"] !== localKeysVersion) {
      throw new Error("ui/select --integration keys did not install the local @diffgazer/keys dependency");
    }
    if (existsSync(join(fixture, "src/hooks/use-navigation.ts"))) {
      throw new Error("keys package mode should not copy local use-navigation.ts");
    }
    writeKeysPackageSelectApp(fixture);
    run("pnpm run typecheck", fixture);
    run("pnpm run build", fixture);

    console.log("OK: keys package integration dependency install/build flow");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

function runBareNameRejectionSmoke() {
  const fixture = mkdtempSync(join(tmpdir(), "smoke-bare-"));
  try {
    writeViteFixture(fixture);
    const dgaddBare = `node ${JSON.stringify(resolve(root, "cli/add/dist/index.js"))}`;
    run(`${dgaddBare} init --cwd ${JSON.stringify(fixture)} --yes`);
    const bareOutput = runFailure(`${dgaddBare} add button --cwd ${JSON.stringify(fixture)} --yes --skip-install`);
    if (!/not found|Invalid item name|Use a namespaced name/.test(bareOutput)) {
      throw new Error(`Expected bare name rejection, got: ${bareOutput.slice(0, 250)}`);
    }
    console.log("OK: bare name rejection");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

runInstallDependencySmoke();
runKeysPackageIntegrationSmoke();
runBareNameRejectionSmoke();

console.log("OK: CLI smoke checks passed");
