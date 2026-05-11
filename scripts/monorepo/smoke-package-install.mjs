#!/usr/bin/env node

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  "@diffgazer/web": "apps/web",
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

function resolveInstalledDependency(workspacePackage, packageName, sourcePackages = [workspacePackage]) {
  for (const sourcePackage of sourcePackages) {
    const packageDir = packageDirs[sourcePackage];
    if (!packageDir) {
      throw new Error(`No smoke package directory configured for ${sourcePackage}`);
    }

    const packagePath = resolve(root, packageDir, "node_modules", ...packageName.split("/"));
    if (existsSync(packagePath)) return realpathSync(packagePath);
  }

  const rootPath = resolve(root, "node_modules", ...packageName.split("/"));
  if (existsSync(rootPath)) return realpathSync(rootPath);

  throw new Error(`Cannot resolve local dependency ${packageName} for ${workspacePackage}`);
}

function localDependencySpecs(workspacePackage, smoke) {
  const workspacePackages = [workspacePackage, ...(smoke.workspaceDeps ?? [])];
  const dependencySourcePackages = [
    workspacePackage,
    ...(smoke.workspaceDeps ?? []),
    ...(smoke.dependencySourcePackages ?? []),
  ];
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
      specs.set(depName, `link:${resolveInstalledDependency(workspacePackage, depName, dependencySourcePackages)}`);
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

function missingLocalInstallDeps(workspacePackage, smoke) {
  const dependencySourcePackages = [
    workspacePackage,
    ...(smoke.workspaceDeps ?? []),
    ...(smoke.dependencySourcePackages ?? []),
  ];
  const missing = [];

  for (const depSpec of smoke.installDeps ?? []) {
    const depName = packageNameFromSpec(depSpec);
    if (!depName || depName.startsWith("@diffgazer/")) continue;

    try {
      resolveInstalledDependency(workspacePackage, depName, dependencySourcePackages);
    } catch {
      missing.push(depName);
    }
  }

  return [...new Set(missing)];
}

function shouldRunPackageSmoke(item) {
  if (networkAllowed() || !item.optionalWhenDepsMissing) return true;

  const missing = missingLocalInstallDeps(item.name, item);
  if (missing.length === 0) return true;

  if (process.env.DIFFGAZER_SMOKE_STRICT_SKIPS === "1") {
    throw new Error(
      `Required smoke dependencies missing for ${item.label ?? item.name}: ${missing.join(", ")}. `
      + "Install them locally or set DIFFGAZER_SMOKE_ALLOW_NETWORK=1.",
    );
  }

  console.log(
    `SKIP: ${item.label ?? item.name} (missing local dependencies: ${missing.join(", ")}; `
    + "set DIFFGAZER_SMOKE_ALLOW_NETWORK=1 to install them, or DIFFGAZER_SMOKE_STRICT_SKIPS=1 to fail on skips)",
  );
  return false;
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

function packWorkspacePackage(workspacePackage, packDir) {
  const packOutput = run(
    `pnpm --dir ${JSON.stringify(root)} --filter ${JSON.stringify(workspacePackage)} pack --pack-destination ${JSON.stringify(packDir)} --json`,
    { cwd: root }
  )
    .toString()
    .trim();

  const parsedPack = parsePackOutput(packOutput);
  const packInfo = Array.isArray(parsedPack) ? parsedPack[0] : parsedPack;
  return resolve(packDir, packInfo?.filename || packInfo?.name || "");
}

function withTempProject(workspacePackage, smoke) {
  const tempRoot = smoke.workspaceTemp === true ? resolve(root, "tmp") : tmpdir();
  mkdirSync(tempRoot, { recursive: true });
  const tempDir = mkdtempSync(resolve(tempRoot, "dg-smoke-"));
  const projectDir = resolve(tempDir);
  const packDir = resolve(tempDir, "packs");
  const tgzPaths = [];
  run("npm -v > /dev/null");

  try {
    mkdirSync(packDir, { recursive: true });
    run("npm init -y", { cwd: projectDir });
    run("npm pkg set type=module", { cwd: projectDir });

    tgzPaths.push(packWorkspacePackage(workspacePackage, packDir));
    for (const dep of smoke.workspaceDeps ?? []) {
      tgzPaths.push(packWorkspacePackage(dep, packDir));
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
      "import { Dialog, DialogContent, DialogTitle } from '@diffgazer/ui/components/dialog';",
      "import { Popover, PopoverTrigger, PopoverContent } from '@diffgazer/ui/components/popover';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@diffgazer/ui/components/select';",
      "import { CommandPalette, CommandPaletteContent, CommandPaletteInput, CommandPaletteList, CommandPaletteItem } from '@diffgazer/ui/components/command-palette';",
      "import { Toaster } from '@diffgazer/ui/components/toast';",
      "import { Tooltip } from '@diffgazer/ui/components/tooltip';",
      "const exports = " + JSON.stringify(exports, null, 2) + ";",
      "for (const exportPath of exports) {",
      "  await import(exportPath);",
      "}",
      "require.resolve('@diffgazer/ui/sources.css');",
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
      "import { Dialog, DialogContent, DialogTitle } from '@diffgazer/ui/components/dialog';",
      "import { Popover, PopoverTrigger, PopoverContent } from '@diffgazer/ui/components/popover';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@diffgazer/ui/components/select';",
      "import { CommandPalette, CommandPaletteContent, CommandPaletteInput, CommandPaletteList, CommandPaletteItem } from '@diffgazer/ui/components/command-palette';",
      "import { Toaster } from '@diffgazer/ui/components/toast';",
      "import { Tooltip } from '@diffgazer/ui/components/tooltip';",
      "const html = renderToString(React.createElement('div', null,",
      "  React.createElement(Button, null, 'Save'),",
      "  React.createElement(Kbd, null, 'S'),",
      "  React.createElement(Dialog, null, React.createElement(DialogContent, null, React.createElement(DialogTitle, null, 'Dialog smoke'))),",
      "  React.createElement(Popover, null, React.createElement(PopoverTrigger, null, 'Popover trigger'), React.createElement(PopoverContent, null, 'Popover smoke')),",
      "  React.createElement(Select, { defaultValue: 'main' }, React.createElement(SelectTrigger, null, React.createElement(SelectValue, { placeholder: 'Branch' })), React.createElement(SelectContent, null, React.createElement(SelectItem, { value: 'main' }, 'main'))),",
      "  React.createElement(CommandPalette, null, React.createElement(CommandPaletteContent, null, React.createElement(CommandPaletteInput, null), React.createElement(CommandPaletteList, null, React.createElement(CommandPaletteItem, { id: 'open' }, 'Open')))),",
      "  React.createElement(Toaster, null),",
      "  React.createElement(Tooltip, { content: 'Tooltip smoke' }, React.createElement('button', { type: 'button' }, 'Tooltip trigger'))",
      "));",
      "for (const expected of ['Save', 'S', 'Popover trigger', 'main', 'Notifications', 'Tooltip trigger']) {",
      "  if (!html.includes(expected)) throw new Error(`Unexpected SSR output missing ${expected}: ${html}`);",
      "}",
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
  writeFileSync(
    resolve(projectDir, "tsconfig.bundler.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        skipLibCheck: false,
        noEmit: true,
      },
      include: ["strict.ts"],
    }, null, 2),
  );
}

function writeUiCommonImportSmoke(projectDir) {
  const exports = getPackageExports("libs/ui", "@diffgazer/ui")
    .filter((exportPath) => exportPath !== "@diffgazer/ui/components/logo/figlet");
  writeFileSync(
    resolve(projectDir, "common-imports.mjs"),
    [
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
      "const exports = " + JSON.stringify(exports, null, 2) + ";",
      "for (const exportPath of exports) {",
      "  await import(exportPath);",
      "}",
      "require.resolve('@diffgazer/ui/sources.css');",
      "require.resolve('@diffgazer/ui/styles.css');",
      "console.log(`OK: imported ${exports.length} common @diffgazer/ui exports`);",
      "",
    ].join("\n"),
  );
}

function writeCssAssertScript(projectDir, label, outputDir = "dist") {
  writeFileSync(
    resolve(projectDir, "assert-css.mjs"),
    [
      "import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "function listFiles(dir) {",
      "  return readdirSync(dir).flatMap((entry) => {",
      "    const path = resolve(dir, entry);",
      "    return statSync(path).isDirectory() ? listFiles(path) : [path];",
      "  });",
      "}",
      `const dist = resolve(process.cwd(), ${JSON.stringify(outputDir)});`,
      "if (!existsSync(dist)) throw new Error('dist directory was not generated');",
      "const css = listFiles(dist).filter((path) => path.endsWith('.css')).map((path) => readFileSync(path, 'utf-8')).join('\\n');",
      "const checks = [",
      "  ['Tailwind button utility', '.bg-primary'],",
      "  ['Tailwind select width utility', '.w-64'],",
      "  ['Diffgazer theme tokens', '--tui-bg'],",
      "  ['Dialog global CSS', 'dialog::backdrop'],",
      "];",
      "for (const [name, expected] of checks) {",
      "  if (!css.includes(expected)) throw new Error(`${name} missing from built CSS: ${expected}`);",
      "}",
      `console.log(${JSON.stringify(`OK: ${label} Tailwind CSS output`)})`,
      "",
    ].join("\n"),
  );
}

function writeUiVitePackageSmoke(projectDir) {
  mkdirSync(resolve(projectDir, "src"), { recursive: true });
  writeFileSync(
    resolve(projectDir, "index.html"),
    `<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n`,
  );
  writeFileSync(
    resolve(projectDir, "src/index.css"),
    [
      '@import "tailwindcss";',
      '@import "@diffgazer/ui/sources.css";',
      '@import "@diffgazer/ui/styles.css";',
      '@source ".";',
      "",
    ].join("\n"),
  );
  writeFileSync(
    resolve(projectDir, "src/main.tsx"),
    [
      "import React from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import { Button } from '@diffgazer/ui/components/button';",
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '@diffgazer/ui/components/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@diffgazer/ui/components/select';",
      "import './index.css';",
      "",
      "function App() {",
      "  return (",
      "    <main className=\"min-h-screen bg-background text-foreground p-6\">",
      "      <Button variant=\"primary\">Package Button</Button>",
      "      <Dialog defaultOpen>",
      "        <DialogContent>",
      "          <DialogHeader><DialogTitle>Package Dialog</DialogTitle></DialogHeader>",
      "          <DialogBody><p className=\"text-sm text-muted-foreground\">Dialog content</p></DialogBody>",
      "          <DialogFooter><DialogClose variant=\"ghost\">Close</DialogClose></DialogFooter>",
      "        </DialogContent>",
      "      </Dialog>",
      "      <Select defaultOpen defaultValue=\"main\" width=\"md\">",
      "        <SelectTrigger><SelectValue placeholder=\"Branch\" /></SelectTrigger>",
      "        <SelectContent>",
      "          <SelectItem value=\"main\">main</SelectItem>",
      "          <SelectItem value=\"develop\">develop</SelectItem>",
      "        </SelectContent>",
      "      </Select>",
      "    </main>",
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ].join("\n"),
  );
  writeFileSync(
    resolve(projectDir, "vite.config.mjs"),
    [
      "import { defineConfig } from 'vite';",
      "import react from '@vitejs/plugin-react';",
      "import tailwindcss from '@tailwindcss/vite';",
      "",
      "export default defineConfig({",
      "  plugins: [react(), tailwindcss()],",
      "});",
      "",
    ].join("\n"),
  );
  writeCssAssertScript(projectDir, "Vite package-mode");
}

function writeUiNextPackageSmoke(projectDir) {
  mkdirSync(resolve(projectDir, "app"), { recursive: true });
  writeFileSync(
    resolve(projectDir, "app/globals.css"),
    [
      '@import "tailwindcss";',
      '@import "@diffgazer/ui/sources.css";',
      '@import "@diffgazer/ui/styles.css";',
      '@source ".";',
      "",
    ].join("\n"),
  );
  writeFileSync(
    resolve(projectDir, "app/layout.tsx"),
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
    resolve(projectDir, "app/page.tsx"),
    [
      "import { Button } from '@diffgazer/ui/components/button';",
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '@diffgazer/ui/components/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@diffgazer/ui/components/select';",
      "",
      "export default function Page() {",
      "  return (",
      "    <main className=\"min-h-screen bg-background text-foreground p-6\">",
      "      <Button variant=\"primary\">Package Button</Button>",
      "      <Dialog defaultOpen>",
      "        <DialogContent>",
      "          <DialogHeader><DialogTitle>Package Dialog</DialogTitle></DialogHeader>",
      "          <DialogBody><p className=\"text-sm text-muted-foreground\">Dialog content</p></DialogBody>",
      "          <DialogFooter><DialogClose variant=\"ghost\">Close</DialogClose></DialogFooter>",
      "        </DialogContent>",
      "      </Dialog>",
      "      <Select defaultOpen defaultValue=\"main\" width=\"md\">",
      "        <SelectTrigger><SelectValue placeholder=\"Branch\" /></SelectTrigger>",
      "        <SelectContent>",
      "          <SelectItem value=\"main\">main</SelectItem>",
      "          <SelectItem value=\"develop\">develop</SelectItem>",
      "        </SelectContent>",
      "      </Select>",
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    resolve(projectDir, "next.config.mjs"),
    [
      "export default {",
      `  turbopack: { root: ${JSON.stringify(root)} },`,
      "};",
      "",
    ].join("\n"),
  );
  writeFileSync(
    resolve(projectDir, "postcss.config.mjs"),
    "export default { plugins: { '@tailwindcss/postcss': {} } };\n",
  );
  writeFileSync(
    resolve(projectDir, "next-env.d.ts"),
    "/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n",
  );
  writeFileSync(
    resolve(projectDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "es2022"],
        allowJs: false,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
      },
      include: ["next-env.d.ts", "app/**/*.ts", "app/**/*.tsx"],
      exclude: ["node_modules"],
    }, null, 2),
  );
  writeCssAssertScript(projectDir, "Next package-mode", ".next");
}

function prepareUiPackageSmoke(projectDir) {
  writeUiPackageModeSmoke(projectDir);
  writeUiVitePackageSmoke(projectDir);
}

function assertSmoke(name, result, expect = /OK/) {
  if (!expect.test(result)) {
    throw new Error(`Smoke failed for ${name}: expected ${expect}, got ${result.slice(0, 300)}`);
  }
}

const packages = [
  {
    name: "@diffgazer/ui",
    label: "@diffgazer/ui common imports",
    workspaceDeps: ["@diffgazer/keys"],
    installDeps: [
      "react@^19.2.0",
      "react-dom@^19.2.0",
    ],
    prepare: writeUiCommonImportSmoke,
    command: "node common-imports.mjs",
    expect: /OK: imported .* common @diffgazer\/ui exports/,
  },
  {
    name: "@diffgazer/ui",
    workspaceDeps: ["@diffgazer/keys"],
    dependencySourcePackages: ["@diffgazer/web"],
    installDeps: [
      "react@^19.2.0",
      "react-dom@^19.2.0",
      "@types/react@^19.2.0",
      "@types/react-dom@^19.2.0",
      "typescript@^5.9.0",
      "vite@^7.3.0",
      "@vitejs/plugin-react@^5.1.0",
      "tailwindcss@^4.1.0",
      "@tailwindcss/vite@^4.1.0",
    ],
    prepare: prepareUiPackageSmoke,
    command: "node import-all.mjs && node ssr.mjs && pnpm exec tsc -p tsconfig.json && pnpm exec tsc -p tsconfig.bundler.json && pnpm exec vite build && node assert-css.mjs",
    expect: /OK: imported .* @diffgazer\/ui exports and resolved package CSS[\s\S]*OK: @diffgazer\/ui SSR render[\s\S]*OK: Vite package-mode Tailwind CSS output/,
  },
  {
    name: "@diffgazer/keys",
    installDeps: ["react@^19.2.0"],
    command: `node -e ${JSON.stringify("import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); require.resolve('@diffgazer/keys/package.json'); import('@diffgazer/keys').then(()=>console.log('OK: @diffgazer/keys import and package.json export')).catch((e)=>{console.error(e); process.exit(1);});")}`,
  },
  {
    name: "@diffgazer/ui",
    label: "@diffgazer/ui Next package-mode CSS",
    workspaceDeps: ["@diffgazer/keys"],
    optionalWhenDepsMissing: true,
    workspaceTemp: true,
    dependencySourcePackages: ["@diffgazer/web"],
    installDeps: [
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
    ],
    prepare: writeUiNextPackageSmoke,
    command: "pnpm exec next build && node assert-css.mjs",
    expect: /OK: Next package-mode Tailwind CSS output/,
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
  if (!shouldRunPackageSmoke(item)) continue;

  const result = withTempProject(item.name, item);
  console.log(result);
  assertSmoke(item.name, result, item.expect);
}

console.log("OK: package install smoke tests passed");
