#!/usr/bin/env node

import { execFileSync, execSync, spawn } from "node:child_process";
import { createServer } from "node:http";
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
import { join, resolve } from "node:path";

const root = process.cwd();

const keysItems = ["navigation", "focus-restore", "focus-trap", "focusable"];
const keysInstallItems = ["navigation", "focus-trap"];
const uiItems = [
  "theme",
  "dialog",
  "select",
  "popover",
  "tooltip",
  "command-palette",
  "block-bar",
  "diff-view",
];

function run(cmd, cwd = root) {
  return execSync(cmd, {
    encoding: "utf8",
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  }).toString();
}

function runFile(command, args, cwd = root) {
  return execFileSync(command, args, {
    encoding: "utf8",
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  }).toString();
}

function runFileAsync(command, args, cwd = root, options = {}) {
  const timeoutMs = options.timeoutMs ?? 180_000;

  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CI: "1", ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: options.shell ?? false,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(" ")}`));
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolveRun(stdout);
        return;
      }
      reject(new Error(
        `Command failed (${signal ?? code}): ${command} ${args.join(" ")}\n${stdout}${stderr}`,
      ));
    });
  });
}

function quoteArgs(args) {
  return args.map((arg) => JSON.stringify(arg)).join(" ");
}

function resolveLocalDependency(packageName) {
  for (const dir of ["apps/web", "libs/ui", "libs/keys", "."]) {
    const depPath = resolve(root, dir, "node_modules", ...packageName.split("/"));
    if (existsSync(depPath)) return `link:${realpathSync(depPath)}`;
  }
  throw new Error(`Cannot resolve local dependency for shadcn smoke: ${packageName}`);
}

function pnpmAddFlags() {
  return process.env.DIFFGAZER_SMOKE_ALLOW_NETWORK === "1"
    ? ["--fetch-retries=0"]
    : ["--offline", "--fetch-retries=0"];
}

function loadRegistryItem(registryDir, name) {
  const path = join(registryDir, `${name}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function assertRegistryItemsExist(registryDir, names, label) {
  for (const name of names) {
    if (!loadRegistryItem(registryDir, name)) {
      throw new Error(`${label} registry item "${name}" not found at ${registryDir}/${name}.json`);
    }
  }
}

function assertKeysTargets(registryDir, names) {
  for (const name of names) {
    const item = loadRegistryItem(registryDir, name);
    for (const file of item.files ?? []) {
      if (!file.target) {
        throw new Error(`Keys item "${name}" file "${file.path}" missing target field`);
      }
    }
  }
}

function assertNoJsImportSpecifiers(registryDir, names) {
  for (const name of names) {
    const item = loadRegistryItem(registryDir, name);
    for (const file of item.files ?? []) {
      if (!file.content) continue;
      if (/from\s+["'][^"']*\.js["']/.test(file.content)) {
        throw new Error(
          `Keys item "${name}" file "${file.path}" contains .js import specifier in public registry`,
        );
      }
    }
  }
}

function writeFixtureBase(fixture, registryBaseUrl) {
  mkdirSync(join(fixture, "src/lib"), { recursive: true });

  writeFileSync(join(fixture, "package.json"), JSON.stringify({
    name: "shadcn-smoke",
    private: true,
    type: "module",
    packageManager: "pnpm@10.28.2",
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
      paths: {
        "@/*": ["./src/*"],
      },
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

  writeFileSync(join(fixture, "src/lib/utils.ts"), [
    'import { type ClassValue, clsx } from "clsx";',
    'import { twMerge } from "tailwind-merge";',
    "",
    "export function cn(...inputs: ClassValue[]) {",
    "  return twMerge(clsx(inputs));",
    "}",
    "",
  ].join("\n"));

  writeFileSync(join(fixture, "src/index.css"), [
    '@import "tailwindcss";',
    '@import "../styles/styles.css";',
    '@source ".";',
    "",
  ].join("\n"));

  writeFileSync(join(fixture, "components.json"), JSON.stringify({
    $schema: "https://ui.shadcn.com/schema.json",
    style: "index",
    rsc: false,
    tsx: true,
    tailwind: {
      config: "",
      css: "src/index.css",
      baseColor: "neutral",
      cssVariables: true,
    },
    aliases: {
      components: "@/components",
      utils: "@/lib/utils",
      ui: "@/components/ui",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    registries: {
      "@diffgazer-ui": `${registryBaseUrl}/ui/{name}.json`,
      "@diffgazer-keys": `${registryBaseUrl}/keys/{name}.json`,
    },
  }, null, 2));
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

  runFile("pnpm", ["add", ...pnpmAddFlags(), ...deps], fixture);
}

async function runShadcnAdd(fixture, items) {
  const override = process.env.DIFFGAZER_SHADCN_COMMAND;
  const addArgs = ["add", ...items, "--cwd", fixture, "--yes", "--overwrite"];

  if (override) {
    await runFileAsync(`${override} ${quoteArgs(addArgs)}`, [], root, { shell: true });
    return;
  }

  await runFileAsync("pnpm", ["dlx", "shadcn@latest", ...addArgs], root);
}

function writeSmokeApp(fixture) {
  writeFileSync(
    join(fixture, "src/main.tsx"),
    [
      "import React from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import { Button } from '@/components/ui/button';",
      "import { BlockBar } from '@/components/ui/block-bar';",
      "import { CommandPalette, CommandPaletteInput, CommandPaletteList, CommandPaletteItem } from '@/components/ui/command-palette';",
      "import { DiffView } from '@/components/ui/diff-view';",
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog';",
      "import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      "import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';",
      "import './index.css';",
      "",
      "function App() {",
      "  return (",
      "    <main className=\"min-h-screen bg-background text-foreground p-6\">",
      "      <Button variant=\"primary\">Direct Button</Button>",
      "      <BlockBar label=\"Progress\" value={8} max={10} />",
      "      <DiffView before=\"const value = 1;\" after=\"const value = 2;\" />",
      "      <Dialog defaultOpen>",
      "        <DialogContent>",
      "          <DialogHeader><DialogTitle>Direct Dialog</DialogTitle></DialogHeader>",
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
      "      <Popover defaultOpen>",
      "        <PopoverTrigger><Button variant=\"secondary\">Details</Button></PopoverTrigger>",
      "        <PopoverContent aria-label=\"Details\">Popover content</PopoverContent>",
      "      </Popover>",
      "      <Tooltip defaultOpen>",
      "        <TooltipTrigger><Button variant=\"ghost\">Hint</Button></TooltipTrigger>",
      "        <TooltipContent>Tooltip content</TooltipContent>",
      "      </Tooltip>",
      "      <CommandPalette open onOpenChange={() => undefined}>",
      "        <CommandPaletteInput placeholder=\"Search\" />",
      "        <CommandPaletteList>",
      "          <CommandPaletteItem id=\"open\" value=\"open\">Open</CommandPaletteItem>",
      "        </CommandPaletteList>",
      "      </CommandPalette>",
      "    </main>",
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ].join("\n"),
  );
}

function assertFileContains(fixture, relativePath, patterns) {
  const path = join(fixture, relativePath);
  if (!existsSync(path)) throw new Error(`Expected installed file missing: ${relativePath}`);

  const content = readFileSync(path, "utf-8");
  for (const pattern of patterns) {
    if (!content.includes(pattern)) {
      throw new Error(`Expected ${relativePath} to contain "${pattern}"`);
    }
  }
}

function startRegistryServer(uiRegistryDir, keysRegistryDir) {
  const registryDirs = new Map([
    ["ui", uiRegistryDir],
    ["keys", keysRegistryDir],
  ]);
  let baseUrl = "";

  function normalizeRegistryDependencies(namespace, item) {
    if (!Array.isArray(item.registryDependencies)) return item;

    // shadcn resolves bare deps from namespaced items against its built-in registry.
    // Serve local URL deps so the smoke can execute the real CLI against this repo.
    return {
      ...item,
      registryDependencies: item.registryDependencies.map((dep) => {
        if (dep.startsWith("http://") || dep.startsWith("https://")) return dep;
        if (dep.startsWith("@diffgazer-keys/") || dep.startsWith("@diffgazer/keys/")) {
          const name = dep.replace(/^@diffgazer-keys\/|^@diffgazer\/keys\//, "");
          return `${baseUrl}/keys/${name}.json`;
        }
        if (dep.startsWith("@")) return dep;
        return `${baseUrl}/${namespace}/${dep}.json`;
      }),
    };
  }

  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const [, namespace, fileName] = url.pathname.split("/");
      const registryDir = registryDirs.get(namespace);

      if (!registryDir || !fileName || !/^(registry|[a-z0-9-]+)\.json$/.test(fileName)) {
        response.writeHead(404).end();
        return;
      }

      const filePath = join(registryDir, fileName);
      if (!existsSync(filePath)) {
        response.writeHead(404).end();
        return;
      }

      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      const json = JSON.parse(readFileSync(filePath, "utf-8"));
      const payload = fileName === "registry.json"
        ? json
        : normalizeRegistryDependencies(namespace, json);
      response.end(JSON.stringify(payload, null, 2));
    } catch (error) {
      response.writeHead(500).end(error instanceof Error ? error.message : String(error));
    }
  });

  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine local registry server address"));
        return;
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolveServer({
        baseUrl,
        close: () => new Promise((resolveClose, rejectClose) => {
          server.close((error) => error ? rejectClose(error) : resolveClose());
        }),
      });
    });
  });
}

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

assertKeysTargets(keysRegistryDir, keysItems);
console.log("OK: keys items have target fields on all files");

assertNoJsImportSpecifiers(keysRegistryDir, keysItems);
console.log("OK: keys public registry has no .js import specifiers");

const registryServer = await startRegistryServer(uiRegistryDir, keysRegistryDir);
const fixture = mkdtempSync(join(tmpdir(), "shadcn-smoke-"));

try {
  writeFixtureBase(fixture, registryServer.baseUrl);
  installFixtureDeps(fixture);
  await runShadcnAdd(fixture, keysInstallItems.map((name) => `@diffgazer-keys/${name}`));
  console.log("OK: shadcn CLI installed keys items through local namespace registries");

  await runShadcnAdd(fixture, uiItems.map((name) => `@diffgazer-ui/${name}`));
  console.log("OK: shadcn CLI installed UI items through local namespace registries");

  assertFileContains(fixture, "src/hooks/use-navigation.ts", ["useNavigation"]);
  assertFileContains(fixture, "src/hooks/use-focus-trap.ts", ["useFocusTrap"]);
  assertFileContains(fixture, "src/components/ui/select/select-content.tsx", [
    "@/hooks/use-navigation",
    "w-full overflow-hidden p-1",
  ]);
  assertFileContains(fixture, "src/components/ui/block-bar/block-bar.tsx", [
    "BlockBar",
    "role={hasAccessibleName ? \"meter\" : undefined}",
  ]);
  assertFileContains(fixture, "src/components/ui/diff-view/diff-view.tsx", [
    "@/hooks/use-navigation",
    "aria-roledescription=\"diff\"",
  ]);
  assertFileContains(fixture, "src/components/ui/popover/popover-content.tsx", [
    "@/hooks/use-outside-click",
    "data-[state=open]:animate-[slide-in_0.15s_ease-out]",
  ]);
  assertFileContains(fixture, "src/components/ui/tooltip/tooltip-content.tsx", [
    "../popover/popover-content",
    "max-w-xs border border-border bg-background",
  ]);
  assertFileContains(fixture, "src/hooks/use-focus-restore.ts", ["useFocusRestore"]);
  assertFileContains(fixture, "src/hooks/utils/focusable.ts", ["isFocusable"]);
  console.log("OK: shadcn CLI resolved UI and keys registry dependency trees");

  writeSmokeApp(fixture);
  run("pnpm run typecheck", fixture);
  run("pnpm run build", fixture);
  console.log("OK: shadcn direct namespace install type-checks and builds");
} finally {
  await registryServer.close();
  rmSync(fixture, { recursive: true, force: true });
}

console.log("OK: shadcn direct-install smoke passed");
