#!/usr/bin/env node

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();

function quoteArgs(args) {
  return args.map((arg) => JSON.stringify(arg)).join(" ");
}

function packageNameFromSpec(spec) {
  if (spec.startsWith("/") || spec.startsWith(".")) return null;
  if (spec.startsWith("@")) {
    const [scope, rest = ""] = spec.split("/");
    const name = rest.split("@")[0];
    return name ? `${scope}/${name}` : null;
  }
  return spec.split("@")[0] || null;
}

function run(cmd, cwd = root) {
  return execSync(cmd, {
    encoding: "utf8",
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  }).toString();
}

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

function resolveLocalDependency(packageName) {
  for (const dir of ["apps/web", "libs/ui", "libs/keys", "."]) {
    const depPath = resolve(root, dir, "node_modules", ...packageName.split("/"));
    if (existsSync(depPath)) return `link:${realpathSync(depPath)}`;
  }
  throw new Error(`Cannot resolve local dependency for CLI smoke: ${packageName}`);
}

function installFixtureDeps(fixture) {
  const deps = [
    "react",
    "react-dom",
    "@types/react",
    "@types/react-dom",
    "typescript",
    "vite",
    "@vitejs/plugin-react",
    "tailwindcss",
    "@tailwindcss/vite",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
  ].map(resolveLocalDependency);

  run(`pnpm add --offline --fetch-retries=0 ${quoteArgs(deps)}`, fixture);
}

function networkAllowed() {
  return process.env.DIFFGAZER_SMOKE_ALLOW_NETWORK === "1";
}

function strictSkipsEnabled() {
  return process.env.DIFFGAZER_SMOKE_STRICT_SKIPS === "1";
}

function pnpmAddFlags() {
  return networkAllowed() ? "--fetch-retries=0" : "--offline --fetch-retries=0";
}

function missingLocalDeps(deps) {
  const missing = [];
  for (const dep of deps) {
    try {
      resolveLocalDependency(dep);
    } catch {
      missing.push(dep);
    }
  }
  return missing;
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function assertBuiltCss(fixture, outputDir = "dist") {
  const css = listFiles(resolve(fixture, outputDir))
    .filter((path) => path.endsWith(".css"))
    .map((path) => readFileSync(path, "utf-8"))
    .join("\n");

  for (const expected of [".bg-primary", ".w-64", "--tui-bg", "dialog::backdrop"]) {
    if (!css.includes(expected)) {
      throw new Error(`Built copy-first CSS is missing ${expected}`);
    }
  }
}

function installDeps(fixture, depSpecs) {
  const deps = networkAllowed()
    ? depSpecs
    : depSpecs.map((dep) => resolveLocalDependency(packageNameFromSpec(dep) ?? dep));
  run(`pnpm add ${pnpmAddFlags()} ${quoteArgs(deps)}`, fixture);
}

function writeViteFixture(fixture) {
  mkdirSync(join(fixture, "src"), { recursive: true });
  writeFileSync(join(fixture, "package.json"), JSON.stringify({
    name: "dgadd-smoke",
    private: true,
    type: "module",
    scripts: {
      typecheck: "tsc -p tsconfig.json",
      build: "vite build",
    },
  }, null, 2));
  writeFileSync(join(fixture, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      lib: ["DOM", "DOM.Iterable", "ES2022"],
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
    include: ["src"],
  }, null, 2));
  writeFileSync(
    join(fixture, "vite.config.mjs"),
    [
      "import { defineConfig } from 'vite';",
      "import react from '@vitejs/plugin-react';",
      "import tailwindcss from '@tailwindcss/vite';",
      "",
      "export default defineConfig({",
      "  plugins: [react(), tailwindcss()],",
      "  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },",
      "});",
      "",
    ].join("\n"),
  );
  writeFileSync(join(fixture, "index.html"), `<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n`);
}

function writeNextFixture(fixture) {
  mkdirSync(join(fixture, "app"), { recursive: true });
  mkdirSync(join(fixture, "src"), { recursive: true });
  writeFileSync(join(fixture, "package.json"), JSON.stringify({
    name: "dgadd-next-smoke",
    private: true,
    type: "module",
  }, null, 2));
  writeFileSync(join(fixture, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      lib: ["DOM", "DOM.Iterable", "ES2022"],
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "preserve",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowJs: false,
      resolveJsonModule: true,
      isolatedModules: true,
      incremental: true,
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
      plugins: [{ name: "next" }],
    },
    include: ["next-env.d.ts", "app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx"],
    exclude: ["node_modules"],
  }, null, 2));
  writeFileSync(join(fixture, "next.config.mjs"), "export default {};\n");
  writeFileSync(join(fixture, "postcss.config.mjs"), "export default { plugins: { '@tailwindcss/postcss': {} } };\n");
  writeFileSync(
    join(fixture, "next-env.d.ts"),
    "/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n",
  );
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
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      "",
      "export default function Page() {",
      "  return (",
      "    <main className=\"min-h-screen bg-background text-foreground p-6\">",
      "      <Button variant=\"primary\">Copy Button</Button>",
      "      <Dialog defaultOpen>",
      "        <DialogContent>",
      "          <DialogHeader><DialogTitle>Copy Dialog</DialogTitle></DialogHeader>",
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
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      "import './index.css';",
      "",
      "function App() {",
      "  return (",
      "    <main className=\"min-h-screen bg-background text-foreground p-6\">",
      "      <Button variant=\"primary\">Copy Button</Button>",
      "      <Dialog defaultOpen>",
      "        <DialogContent>",
      "          <DialogHeader><DialogTitle>Copy Dialog</DialogTitle></DialogHeader>",
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
    if (missing.length > 0) {
      if (strictSkipsEnabled()) {
        throw new Error(
          `Required smoke dependencies missing for dgadd Next copy-first build: ${missing.join(", ")}. `
          + "Install them locally or set DIFFGAZER_SMOKE_ALLOW_NETWORK=1.",
        );
      }
      console.log(
        `SKIP: dgadd Next copy-first build (missing local dependencies: ${missing.join(", ")}; `
        + "set DIFFGAZER_SMOKE_ALLOW_NETWORK=1 to install them, or DIFFGAZER_SMOKE_STRICT_SKIPS=1 to fail on skips)",
      );
      return;
    }
  }

  const fixture = mkdtempSync(join(tmpdir(), "dgadd-next-smoke-"));
  try {
    writeNextFixture(fixture);
    installDeps(fixture, nextDeps);
    run(`${dgadd} init --cwd ${JSON.stringify(fixture)} --yes --skip-install`);
    run(`${dgadd} add ui/button ui/dialog ui/select ui/form-reset --cwd ${JSON.stringify(fixture)} --yes --skip-install`);
    assertCopyFirstCssInstall(fixture);
    writeNextCopyFirstApp(fixture);
    run("pnpm exec next build", fixture);
    assertBuiltCss(fixture, ".next");
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
  installFixtureDeps(fixture);

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
  assertBuiltCss(fixture);
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

console.log("OK: CLI smoke checks passed");
