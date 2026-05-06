#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = process.cwd();

function run(cmd, options = {}) {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    shell: true,
  });
}

function quoteArgs(args) {
  return args.map((arg) => JSON.stringify(arg)).join(" ");
}

function pnpmAddFlags() {
  return process.env.DIFFGAZER_SMOKE_ALLOW_NETWORK === "1"
    ? "--fetch-retries=0"
    : "--offline --fetch-retries=0";
}

function networkAllowed() {
  return process.env.DIFFGAZER_SMOKE_ALLOW_NETWORK === "1";
}

const packageDirs = {
  "@diffgazer/ui": "libs/ui",
  "@diffgazer/keys": "libs/keys",
  "@diffgazer/add": "cli/add",
  diffgazer: "cli/diffgazer",
};

function packageNameFromSpec(spec) {
  if (spec.startsWith("/") || spec.startsWith(".")) return null;
  if (spec.startsWith("@")) {
    const [scope, rest = ""] = spec.split("/");
    const name = rest.split("@")[0];
    return name ? `${scope}/${name}` : null;
  }
  return spec.split("@")[0] || null;
}

function readPackageJson(workspacePackage) {
  const packageDir = packageDirs[workspacePackage];
  if (!packageDir) {
    throw new Error(`No smoke package directory configured for ${workspacePackage}`);
  }
  return JSON.parse(readFileSync(resolve(root, packageDir, "package.json"), "utf-8"));
}

function resolveInstalledDependency(workspacePackage, packageName) {
  const packageDir = packageDirs[workspacePackage];
  if (!packageDir) {
    throw new Error(`No smoke package directory configured for ${workspacePackage}`);
  }

  const packagePath = resolve(root, packageDir, "node_modules", ...packageName.split("/"));
  if (existsSync(packagePath)) return realpathSync(packagePath);

  const rootPath = resolve(root, "node_modules", ...packageName.split("/"));
  if (existsSync(rootPath)) return realpathSync(rootPath);

  throw new Error(`Cannot resolve local dependency ${packageName} for ${workspacePackage}`);
}

function localDependencySpecs(workspacePackage, smoke) {
  const workspacePackages = [workspacePackage, ...(smoke.workspaceDeps ?? [])];
  const specs = new Map();

  for (const packageName of workspacePackages) {
    const pkg = readPackageJson(packageName);
    for (const depName of Object.keys(pkg.dependencies ?? {})) {
      if (!depName.startsWith("@diffgazer/")) {
        specs.set(depName, `link:${resolveInstalledDependency(packageName, depName)}`);
      }
    }
  }

  for (const depSpec of smoke.installDeps ?? []) {
    const depName = packageNameFromSpec(depSpec);
    if (depName && !depName.startsWith("@diffgazer/")) {
      specs.set(depName, `link:${resolveInstalledDependency(workspacePackage, depName)}`);
    }
  }

  return new Map([...specs.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function writeOfflineOverrides(projectDir, workspacePackage, smoke) {
  const specs = localDependencySpecs(workspacePackage, smoke);
  if (specs.size === 0) return specs;

  const packageJsonPath = resolve(projectDir, "package.json");
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  pkg.pnpm = {
    ...(pkg.pnpm ?? {}),
    overrides: {
      ...(pkg.pnpm?.overrides ?? {}),
      ...Object.fromEntries(specs),
    },
  };
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return specs;
}

function parsePackOutput(raw) {
  const starts = [...raw.matchAll(/[\[{]/g)].map((match) => match.index ?? 0);
  const ends = [...raw.matchAll(/[\]}]/g)].map((match) => match.index ?? 0).reverse();

  for (const start of starts) {
    for (const end of ends) {
      if (end <= start) continue;
      const candidate = raw.slice(start, end + 1);
      try {
        const parsed = JSON.parse(candidate);
        const packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
        if (packInfo?.filename) return parsed;
      } catch {
        // pnpm lifecycle logs can be mixed into stdout; keep scanning.
      }
    }
  }

  throw new Error(`Could not parse pnpm pack --json output:\n${raw.slice(0, 1000)}`);
}

function packWorkspacePackage(workspacePackage) {
  const packOutput = run(
    `pnpm --dir ${JSON.stringify(root)} --filter ${JSON.stringify(workspacePackage)} pack --json`,
    { cwd: root }
  )
    .toString()
    .trim();

  const parsedPack = parsePackOutput(packOutput);
  const packInfo = Array.isArray(parsedPack) ? parsedPack[0] : parsedPack;
  return resolve(root, packInfo?.filename || packInfo?.name || "");
}

function withTempProject(workspacePackage, smoke) {
  const tempDir = mkdtempSync(`${tmpdir()}/dg-smoke-`);
  const projectDir = resolve(tempDir);
  const tgzPaths = [];
  run("npm -v > /dev/null");

  try {
    run("npm init -y", { cwd: projectDir });
    run("npm pkg set type=module", { cwd: projectDir });

    tgzPaths.push(packWorkspacePackage(workspacePackage));
    for (const dep of smoke.workspaceDeps ?? []) {
      tgzPaths.push(packWorkspacePackage(dep));
    }
    const installDeps = networkAllowed()
      ? (smoke.installDeps ?? [])
      : [...writeOfflineOverrides(projectDir, workspacePackage, smoke).values()];
    run(`pnpm add ${pnpmAddFlags()} ${quoteArgs([...tgzPaths, ...installDeps])}`, { cwd: projectDir });
    smoke.prepare?.(projectDir);
    const result = run(smoke.command, { cwd: projectDir });
    return result.toString().trim();
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
    for (const tgzPath of tgzPaths) {
      if (tgzPath.endsWith(".tgz") && existsSync(tgzPath)) {
        rmSync(tgzPath, { force: true });
      }
    }
  }
}

function getPackageExports(packageDir, packageName) {
  const pkg = JSON.parse(readFileSync(resolve(root, packageDir, "package.json"), "utf-8"));
  return Object.keys(pkg.exports ?? {})
    .filter((exportPath) => exportPath !== ".")
    .filter((exportPath) => !exportPath.endsWith(".css"))
    .map((exportPath) => `${packageName}${exportPath.slice(1)}`)
    .sort();
}

function writeUiPackageModeSmoke(projectDir) {
  const exports = getPackageExports("libs/ui", "@diffgazer/ui");
  writeFileSync(
    resolve(projectDir, "import-all.mjs"),
    [
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
      "const exports = " + JSON.stringify(exports, null, 2) + ";",
      "for (const exportPath of exports) {",
      "  await import(exportPath);",
      "}",
      "require.resolve('@diffgazer/ui/styles.css');",
      "console.log(`OK: imported ${exports.length} @diffgazer/ui exports and resolved package CSS`);",
      "",
    ].join("\n"),
  );
  writeFileSync(
    resolve(projectDir, "ssr.mjs"),
    [
      "import React from 'react';",
      "import { renderToString } from 'react-dom/server';",
      "import { Button } from '@diffgazer/ui/components/button';",
      "import { Kbd } from '@diffgazer/ui/components/kbd';",
      "const html = renderToString(React.createElement('div', null,",
      "  React.createElement(Button, null, 'Save'),",
      "  React.createElement(Kbd, null, 'S')",
      "));",
      "if (!html.includes('Save') || !html.includes('S')) throw new Error(`Unexpected SSR output: ${html}`);",
      "console.log('OK: @diffgazer/ui SSR render');",
      "",
    ].join("\n"),
  );
  writeFileSync(
    resolve(projectDir, "strict.ts"),
    [
      ...exports.map((exportPath, index) => `type UiExport${index} = typeof import(${JSON.stringify(exportPath)});`),
      "import { Button } from '@diffgazer/ui/components/button';",
      "import type { ButtonProps } from '@diffgazer/ui/components/button';",
      "import { useKey } from '@diffgazer/keys';",
      "type UiExportCount = " + exports.map((_, index) => `UiExport${index}`).join(" | ") + ";",
      "const ButtonRef = Button;",
      "const props = { variant: 'primary' } satisfies ButtonProps;",
      "const uiExportCount = 0 as unknown as UiExportCount;",
      "void ButtonRef;",
      "void props;",
      "void uiExportCount;",
      "void useKey;",
      "",
    ].join("\n"),
  );
  writeFileSync(
    resolve(projectDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        jsx: "react-jsx",
        skipLibCheck: false,
        noEmit: true,
      },
      include: ["strict.ts"],
    }, null, 2),
  );
}

function assertSmoke(name, result, expect = /OK/) {
  if (!expect.test(result)) {
    throw new Error(`Smoke failed for ${name}: expected ${expect}, got ${result.slice(0, 300)}`);
  }
}

const packages = [
  {
    name: "@diffgazer/ui",
    workspaceDeps: ["@diffgazer/keys"],
    installDeps: ["react@^19.0.0", "react-dom@^19.0.0", "@types/react@^19.0.0", "@types/react-dom@^19.0.0", "typescript@^5.9.0"],
    prepare: writeUiPackageModeSmoke,
    command: "node import-all.mjs && node ssr.mjs && pnpm exec tsc -p tsconfig.json",
    expect: /OK: imported .* @diffgazer\/ui exports and resolved package CSS[\s\S]*OK: @diffgazer\/ui SSR render/,
  },
  {
    name: "@diffgazer/keys",
    installDeps: ["react@^19.0.0"],
    command: `node -e ${JSON.stringify("import('@diffgazer/keys').then(()=>console.log('OK: @diffgazer/keys import')).catch((e)=>{console.error(e); process.exit(1);});")}`,
  },
  {
    name: "diffgazer",
    command: "pnpm exec diffgazer --help",
    expect: /Usage:|Diffgazer|diffgazer/i,
  },
  {
    name: "@diffgazer/add",
    command: "pnpm exec dgadd --help",
    expect: /Usage: dgadd|Install Diffgazer UI/i,
  },
];

for (const item of packages) {
  const result = withTempProject(item.name, item);
  console.log(result);
  assertSmoke(item.name, result, item.expect);
}

console.log("OK: package install smoke tests passed");
