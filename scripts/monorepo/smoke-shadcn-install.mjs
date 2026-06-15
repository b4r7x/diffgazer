#!/usr/bin/env node

// Exit-code contract: this smoke runner exits non-zero when a check fails. A
// failed assertion throws, which Node surfaces as a non-zero exit; the registry
// server is closed and temp-dir cleanup runs in the try/finally block before the
// throw propagates. Do not swap the throws for process.exit() — that would
// bypass the finally cleanup and leak the server and fixture directories.

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ENV } from "./lib/env.mjs";
import { collectMissingClosure } from "./registry-closure.mjs";
import {
  assertBuiltCss,
  installViteFixtureDeps,
  joinLines,
  runArgv,
  writeViteFixture,
} from "./smoke-shared.mjs";

const root = process.cwd();
const uiPackageJsonPath = resolve(root, "libs/ui/package.json");

const keysItems = ["navigation", "focus-restore", "focus-trap", "focusable"];
const keysInstallItems = ["navigation", "focus-trap"];
const uiItems = [
  "theme",
  "checkbox",
  "dialog",
  "select",
  "popover",
  "tooltip",
  "command-palette",
  "block-bar",
  "diff-view",
  "menu",
  "navigation-list",
  "code-block",
  "sidebar",
  "tabs",
  "accordion",
  "stepper",
];

function registryRouteFromUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const offset = parts[0] === "r" ? 1 : 0;
  const namespace = parts[offset];
  const fileName = parts[offset + 1];
  if (parts.length !== offset + 2) return null;
  if (namespace !== "ui" && namespace !== "keys") return null;
  if (!fileName || !/^(registry|[a-z0-9-]+)\.json$/.test(fileName)) return null;
  return `/${namespace}/${fileName}`;
}

function runFileAsync(command, args, cwd = root, options = {}) {
  const timeoutMs = options.timeoutMs ?? 180_000;

  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, [ENV.ci]: "1", ...options.env },
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
      reject(
        new Error(
          `Command failed (${signal ?? code}): ${command} ${args.join(" ")}\n${stdout}${stderr}`,
        ),
      );
    });
  });
}

function loadRegistryItem(registryDir, name) {
  const path = join(registryDir, `${name}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

// Every item name listed in a public registry.json index — the full set used as
// closure roots so items outside the representative install fixtures (radio,
// toggle-group, scroll-lock, ...) are still closure-validated.
function allRegistryIndexNames(registryDir) {
  const index = JSON.parse(readFileSync(join(registryDir, "registry.json"), "utf-8"));
  return (index.items ?? []).map((item) => item.name);
}

function assertRegistryItemsExist(registryDir, names, label) {
  for (const name of names) {
    if (!loadRegistryItem(registryDir, name)) {
      throw new Error(`${label} registry item "${name}" not found at ${registryDir}/${name}.json`);
    }
  }
}

// Every `r/keys` URL registryDependency must point at a keys item that actually
// exists in libs/keys/public/r — the cross-registry target-existence check no
// other gate performs (bundle validates only local deps; metadata validates only
// URL shape).
function assertCrossRegistryTargetsExist(registryDir, names, keysRegistryDir, label) {
  for (const name of names) {
    const item = loadRegistryItem(registryDir, name);
    for (const dep of item.registryDependencies ?? []) {
      const route = registryRouteFromUrl(dep);
      if (!route) continue;
      const [, namespace, fileName] = route.split("/");
      if (namespace !== "keys") continue;
      const targetName = fileName.replace(/\.json$/, "");
      if (!loadRegistryItem(keysRegistryDir, targetName)) {
        throw new Error(
          `${label} item "${name}" registry dependency "${dep}" points at a keys item that does not exist in ${keysRegistryDir}`,
        );
      }
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

function assertDirectRegistryDependencies(registryDir, names, label) {
  for (const name of names) {
    const item = loadRegistryItem(registryDir, name);
    for (const dep of item.registryDependencies ?? []) {
      if (dep.startsWith("http://") || dep.startsWith("https://")) {
        if (!registryRouteFromUrl(dep)) {
          throw new Error(
            `${label} item "${name}" registry dependency "${dep}" is not a localizable registry URL`,
          );
        }
        continue;
      }
      if (dep.startsWith("@")) {
        throw new Error(
          `${label} item "${name}" registry dependency "${dep}" is namespaced, not direct URL ready`,
        );
      }
      throw new Error(
        `${label} item "${name}" registry dependency "${dep}" is bare, not direct URL ready`,
      );
    }
  }
}

function makeRegistryResolver(registryDirs) {
  return (ref) => {
    const route = registryRouteFromUrl(ref);
    if (!route) return null;

    const [, namespace, fileName] = route.split("/");
    const registryDir = registryDirs.get(namespace);
    if (!registryDir) return null;

    const name = fileName.replace(/\.json$/, "");
    const item = loadRegistryItem(registryDir, name);
    return item ? { id: route, item } : null;
  };
}

function assertRegistryClosure(registryDirs, rootRefs, label) {
  const missing = collectMissingClosure(rootRefs, makeRegistryResolver(registryDirs));
  if (missing.length > 0) {
    const details = missing.map(({ ref, reason }) => `${ref} (${reason})`).join(", ");
    throw new Error(`${label} registry dependency closure is incomplete: ${details}`);
  }
}

async function runShadcnAdd(fixture, items) {
  const override = process.env[ENV.shadcnCommand];
  const addArgs = ["add", ...items, "--cwd", fixture, "--yes", "--overwrite"];

  if (override) {
    await runFileAsync(override, addArgs, root);
    return;
  }

  const localBin = resolveLocalShadcnBin();
  if (localBin) {
    await runFileAsync(localBin, addArgs, root);
    return;
  }

  await runFileAsync("pnpm", ["dlx", getWorkspaceShadcnSpec(), ...addArgs], root);
}

function resolveLocalShadcnBin() {
  for (const dir of [root, resolve(root, "libs/ui"), resolve(root, "libs/keys")]) {
    const bin = resolve(dir, "node_modules/.bin/shadcn");
    if (existsSync(bin)) return realpathSync(bin);
  }
  return null;
}

function getWorkspaceShadcnSpec() {
  const metadata = JSON.parse(readFileSync(uiPackageJsonPath, "utf-8"));
  const version = metadata.devDependencies?.shadcn;
  if (typeof version !== "string" || version.trim() === "") {
    throw new Error("libs/ui/package.json must declare a shadcn devDependency for smoke:shadcn");
  }
  return `shadcn@${version}`;
}

function writeSmokeApp(fixture) {
  writeFileSync(
    join(fixture, "src/main.tsx"),
    joinLines(
      "import React from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import { Button } from '@/components/ui/button';",
      "import { BlockBar } from '@/components/ui/block-bar';",
      "import { Checkbox } from '@/components/ui/checkbox';",
      "import { CommandPalette, CommandPaletteInput, CommandPaletteList, CommandPaletteItem } from '@/components/ui/command-palette';",
      "import { DiffView } from '@/components/ui/diff-view';",
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogCloseIcon } from '@/components/ui/dialog';",
      "import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      "import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';",
      "import './index.css';",
      "",
      "function App() {",
      "  return (",
      '    <main className="min-h-screen bg-background text-foreground p-6">',
      '      <Button variant="primary">Direct Button</Button>',
      '      <Checkbox defaultChecked label="Direct Checkbox" />',
      '      <BlockBar label="Progress" value={8} max={10} />',
      '      <DiffView before="const value = 1;" after="const value = 2;" />',
      "      <Dialog defaultOpen>",
      "        <DialogContent>",
      "          <DialogHeader><DialogTitle>Direct Dialog</DialogTitle></DialogHeader>",
      '          <DialogBody><p className="text-sm text-muted-foreground">Dialog content</p></DialogBody>',
      '          <DialogFooter><DialogClose variant="ghost">Close</DialogClose></DialogFooter>',
      "          <DialogCloseIcon />",
      "        </DialogContent>",
      "      </Dialog>",
      '      <Select defaultOpen defaultValue="main" width="md">',
      '        <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>',
      "        <SelectContent>",
      '          <SelectItem value="main">main</SelectItem>',
      '          <SelectItem value="develop">develop</SelectItem>',
      "        </SelectContent>",
      "      </Select>",
      "      <Popover defaultOpen>",
      '        <PopoverTrigger><Button variant="secondary">Details</Button></PopoverTrigger>',
      '        <PopoverContent aria-label="Details">Popover content</PopoverContent>',
      "      </Popover>",
      "      <Tooltip defaultOpen>",
      '        <TooltipTrigger><Button variant="ghost">Hint</Button></TooltipTrigger>',
      "        <TooltipContent>Tooltip content</TooltipContent>",
      "      </Tooltip>",
      "      <CommandPalette open onOpenChange={() => undefined}>",
      '        <CommandPaletteInput placeholder="Search" />',
      "        <CommandPaletteList>",
      '          <CommandPaletteItem id="open" value="open">Open</CommandPaletteItem>',
      "        </CommandPaletteList>",
      "      </CommandPalette>",
      "    </main>",
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ),
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

export function rewriteRegistryUrls(value, baseUrl) {
  if (typeof value === "string") {
    const route = registryRouteFromUrl(value);
    return route ? `${baseUrl}${route}` : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteRegistryUrls(item, baseUrl));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewriteRegistryUrls(item, baseUrl)]),
    );
  }
  return value;
}

export function createRegistryHandler(registryDirs, getBaseUrl) {
  return (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathParts = url.pathname.split("/").filter(Boolean);
      const namespace = pathParts[0] === "r" ? pathParts[1] : pathParts[0];
      const fileName = pathParts[0] === "r" ? pathParts[2] : pathParts[1];
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
      response.end(JSON.stringify(rewriteRegistryUrls(json, getBaseUrl()), null, 2));
    } catch (error) {
      response.writeHead(500).end(error instanceof Error ? error.message : String(error));
    }
  };
}

function startRegistryServer(uiRegistryDir, keysRegistryDir) {
  const registryDirs = new Map([
    ["ui", uiRegistryDir],
    ["keys", keysRegistryDir],
  ]);
  let baseUrl = "";
  const server = createServer(createRegistryHandler(registryDirs, () => baseUrl));

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
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((error) => (error ? rejectClose(error) : resolveClose()));
          }),
      });
    });
  });
}

function writeShadcnFixture(fixture, baseUrl) {
  writeViteFixture(fixture, {
    name: "shadcn-smoke",
    packageManager: "pnpm@10.28.2",
    withLibUtils: true,
    indexCss: ['@import "tailwindcss";', '@import "../styles/styles.css";', '@source ".";', ""],
    componentsJson: true,
    componentRegistries: {
      "@ui": `${baseUrl}/ui/{name}.json`,
      "@diffgazer-keys": `${baseUrl}/keys/{name}.json`,
    },
  });
  installViteFixtureDeps(root, fixture);
}

function assertInstalledRegistryTree(fixture) {
  assertFileContains(fixture, "src/hooks/use-navigation.ts", ["useNavigation"]);
  assertFileContains(fixture, "src/components/ui/checkbox/checkbox-group.tsx", [
    "@/hooks/use-navigation",
  ]);
  assertFileContains(fixture, "src/hooks/use-focus-trap.ts", ["useFocusTrap"]);
  assertFileContains(fixture, "src/components/ui/select/select-content.tsx", [
    "@/hooks/use-navigation",
    "w-full overflow-hidden p-1",
  ]);
  assertFileContains(fixture, "src/components/ui/block-bar/block-bar.tsx", [
    "BlockBar",
    'role={hasAccessibleName ? "meter" : undefined}',
  ]);
  assertFileContains(fixture, "src/components/ui/diff-view/diff-view.tsx", [
    "@/hooks/use-navigation",
    'aria-roledescription={ariaRoleDescriptionProp ?? "diff"}',
  ]);
  assertFileContains(fixture, "src/components/ui/popover/popover-content.tsx", [
    "@/hooks/use-outside-click",
    "../floating-panel",
    "FloatingPanel",
  ]);
  assertFileContains(fixture, "src/components/ui/floating-panel/floating-panel.tsx", [
    "ui-floating-panel",
    "data-positioned",
    "--ui-content-transform-origin",
    "@/hooks/use-composed-refs",
    "../shared/portal",
    "@/hooks/use-presence",
    "@/hooks/use-floating-position",
  ]);
  assertFileContains(fixture, "src/components/ui/tooltip/tooltip-content.tsx", [
    "../popover/popover-content",
    "max-w-xs border border-border bg-background",
  ]);
  assertFileContains(fixture, "src/hooks/use-focus-restore.ts", ["useFocusRestore"]);
  assertFileContains(fixture, "src/hooks/utils/focusable.ts", ["isFocusable"]);
  assertFileContains(fixture, "styles/dialog.css", ["dialog::backdrop"]);
}

function assertFixtureBuilds(fixture, label) {
  writeSmokeApp(fixture);
  runArgv("pnpm", ["run", "typecheck"], fixture);
  runArgv("pnpm", ["run", "build"], fixture);
  assertBuiltCss(fixture, { label });
}

function writeSoloButtonApp(fixture) {
  writeFileSync(
    join(fixture, "src/main.tsx"),
    joinLines(
      "import React from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import { Button } from '@/components/ui/button';",
      "import './index.css';",
      "",
      "function App() {",
      "  return (",
      '    <main className="min-h-screen bg-background text-foreground p-6">',
      '      <Button variant="primary">Solo Button</Button>',
      "    </main>",
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ),
  );
}

function assertThemeFilesInstalled(fixture) {
  for (const relative of ["styles/theme-base.css", "styles/theme.css", "styles/styles.css"]) {
    if (!existsSync(join(fixture, relative))) {
      throw new Error(`Expected theme file missing after solo install: ${relative}`);
    }
  }
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

const allUiNames = allRegistryIndexNames(uiRegistryDir);
const allKeysNames = allRegistryIndexNames(keysRegistryDir);

assertKeysTargets(keysRegistryDir, allKeysNames);
console.log("OK: keys items have target fields on all files");

assertNoJsImportSpecifiers(keysRegistryDir, allKeysNames);
console.log("OK: keys public registry has no .js import specifiers");

assertDirectRegistryDependencies(uiRegistryDir, uiItems, "UI");
console.log("OK: UI public registry dependencies are direct URL ready");

assertCrossRegistryTargetsExist(uiRegistryDir, allUiNames, keysRegistryDir, "UI");
console.log("OK: UI registry keys URL dependencies point at existing keys items");

const registryDirs = new Map([
  ["ui", uiRegistryDir],
  ["keys", keysRegistryDir],
]);
const closureRoots = [
  ...allUiNames.map((name) => `https://r.b4r7.dev/r/ui/${name}.json`),
  ...allKeysNames.map((name) => `https://r.b4r7.dev/r/keys/${name}.json`),
];
assertRegistryClosure(registryDirs, closureRoots, "public");
console.log("OK: all public registry items resolve their full dependency closure");

const registryServer = await startRegistryServer(uiRegistryDir, keysRegistryDir);
const directFixture = mkdtempSync(join(tmpdir(), "shadcn-smoke-direct-"));
const namespaceFixture = mkdtempSync(join(tmpdir(), "shadcn-smoke-namespace-"));
const soloFixture = mkdtempSync(join(tmpdir(), "shadcn-smoke-solo-"));

try {
  writeShadcnFixture(directFixture, registryServer.baseUrl);
  await runShadcnAdd(
    directFixture,
    uiItems.map((name) => `${registryServer.baseUrl}/ui/${name}.json`),
  );
  console.log(
    "OK: shadcn CLI installed UI items and transitive keys through direct local registry URLs",
  );

  await runShadcnAdd(
    directFixture,
    keysInstallItems.map((name) => `${registryServer.baseUrl}/keys/${name}.json`),
  );
  console.log("OK: shadcn CLI installed standalone keys items through direct local registry URLs");
  assertInstalledRegistryTree(directFixture);

  writeShadcnFixture(namespaceFixture, registryServer.baseUrl);
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

  assertFixtureBuilds(directFixture, "Built direct shadcn");
  console.log("OK: shadcn direct URL install type-checks and builds");

  assertFixtureBuilds(namespaceFixture, "Built namespace shadcn");
  console.log("OK: shadcn direct namespace install type-checks and builds");

  // NEW-017 regression: installing a single component must auto-install the theme
  // registry item via transitive registryDependencies. Without it, theme tokens
  // referenced by component class names resolve to nothing and the build is unstyled.
  writeShadcnFixture(soloFixture, registryServer.baseUrl);
  await runShadcnAdd(soloFixture, [`${registryServer.baseUrl}/ui/button.json`]);
  assertThemeFilesInstalled(soloFixture);
  console.log("OK: solo button install auto-pulled theme via registryDependencies");

  writeSoloButtonApp(soloFixture);
  runArgv("pnpm", ["run", "typecheck"], soloFixture);
  runArgv("pnpm", ["run", "build"], soloFixture);
  assertBuiltCss(soloFixture, {
    label: "Built solo button shadcn",
    // Dialog isn't part of solo install — only assert theme tokens reach final CSS.
    expected: [".bg-primary", "--base-bg"],
  });
  console.log("OK: solo button install type-checks and builds with auto-installed theme");
} finally {
  await registryServer.close();
  rmSync(directFixture, { recursive: true, force: true });
  rmSync(namespaceFixture, { recursive: true, force: true });
  rmSync(soloFixture, { recursive: true, force: true });
}

console.log("OK: shadcn direct-install smoke passed");
