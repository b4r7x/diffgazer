import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { CommandFailedError, runArgv } from "../smoke-shared/command.mjs";
import {
  installViteFixtureDeps,
  packWorkspacePackage,
  pnpmAddFlags,
  resolveLocalDependency as resolveWorkspaceDependency,
} from "../smoke-shared/dependencies.mjs";
import { joinLines, writeViteFixture } from "../smoke-shared/fixtures.mjs";

async function runFailureArgv(root, command, args, cwd = root) {
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

async function runInstallDependencySmoke(root, dgaddBin, rootPackageManager) {
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

async function runKeysPackageIntegrationSmoke(root, dgaddBin) {
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

    const selectNavigationPath = join(
      fixture,
      "src/components/ui/select/use-content-navigation.ts",
    );
    const selectNavigation = readFileSync(selectNavigationPath, "utf-8");
    if (!selectNavigation.includes("@diffgazer/keys")) {
      throw new Error(
        "use-content-navigation.ts does not contain @diffgazer/keys import in keys mode",
      );
    }
    if (selectNavigation.includes("@/hooks/use-navigation")) {
      throw new Error(
        "use-content-navigation.ts still references @/hooks/use-navigation in keys mode",
      );
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

async function runBareNameRejectionSmoke(root, dgaddBin) {
  const fixture = mkdtempSync(join(tmpdir(), "smoke-bare-"));
  try {
    writeViteFixture(fixture);
    await runArgv("node", [dgaddBin, "init", "--cwd", fixture, "--yes"]);
    const bareOutput = await runFailureArgv(root, "node", [
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

export async function runPackageModeSmoke({ root, dgaddBin, rootPackageManager }) {
  await runInstallDependencySmoke(root, dgaddBin, rootPackageManager);
  await runKeysPackageIntegrationSmoke(root, dgaddBin);
  await runBareNameRejectionSmoke(root, dgaddBin);
}
