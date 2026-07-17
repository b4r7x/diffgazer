#!/usr/bin/env node

// Do not swap throws for process.exit(): that bypasses the try/finally cleanup and leaks the registry server and fixture dirs.

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeOrigin, REGISTRY_ORIGIN, resolveRegistryRoute } from "@diffgazer/registry";
import { ENV } from "./lib/env.mjs";
import { collectMissingClosure } from "./registry-closure.mjs";
import {
  assertBuiltCss,
  installViteFixtureDeps,
  joinLines,
  resolveLocalDependency,
  runArgv,
  writeViteFixture,
} from "./smoke-shared.mjs";

const root = process.cwd();
const uiPackageJsonPath = resolve(root, "libs/ui/package.json");
const rootPackageManager = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf-8"),
).packageManager;
const registryOrigin = normalizeOrigin(process.env.REGISTRY_ORIGIN, {
  defaultOrigin: REGISTRY_ORIGIN,
});

const keysItems = ["navigation", "focus-restore", "focus-trap", "focusable"];
const keysInstallItems = ["navigation", "focus-trap"];
export const uiItems = [
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
  return resolveRegistryRoute(value, { origin: registryOrigin });
}

function loadRegistryItem(registryDir, name) {
  const path = join(registryDir, `${name}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function allRegistryIndexNames(registryDir) {
  const index = JSON.parse(readFileSync(join(registryDir, "registry.json"), "utf-8"));
  return (index.items ?? []).map((item) => item.name);
}

function publicRegistryFileNames(registryDir) {
  return readdirSync(registryDir)
    .filter((entry) => entry.endsWith(".json") && entry !== "registry.json")
    .map((entry) => entry.slice(0, -".json".length));
}

// The browsable index plus hidden leaf add-ons nothing depends on (code-block-highlight, logo-figlet).
// Hidden items that ARE depended upon (portal, dialog-shell, *-variants) are transitive-only internals,
// exercised through their parents, never as install roots.
export function directlyInstallableUiNames(registryDir) {
  const indexNames = allRegistryIndexNames(registryDir);
  const indexSet = new Set(indexNames);
  const fileNames = publicRegistryFileNames(registryDir);

  const dependedUpon = new Set();
  for (const name of fileNames) {
    const item = loadRegistryItem(registryDir, name);
    for (const dep of item?.registryDependencies ?? []) {
      const target = dep
        .split("/")
        .pop()
        ?.replace(/\.json$/, "");
      if (target) dependedUpon.add(target);
    }
  }

  const hiddenAddons = fileNames.filter((name) => {
    if (indexSet.has(name)) return false;
    const item = loadRegistryItem(registryDir, name);
    return item?.type === "registry:ui" && item?.meta?.hidden === true && !dependedUpon.has(name);
  });

  return [...indexNames, ...hiddenAddons];
}

// Fixture-relative path a registry file lands at after `shadcn add` resolves the components.json
// aliases (ui → @/components/ui, hooks → @/hooks, lib → @/lib) and explicit `target` fields
// (@ui/ → src/components/ui; ~/ → project root; bare src/ verbatim).
export function installedFilePathForFile(file) {
  if (file.target) {
    if (file.target.startsWith("@ui/")) {
      return `src/components/ui/${file.target.slice("@ui/".length)}`;
    }
    if (file.target.startsWith("~/")) return file.target.slice(2);
    return file.target;
  }
  const aliasPrefixes = [
    ["registry/ui/", "src/components/ui/"],
    ["registry/hooks/", "src/hooks/"],
    ["registry/lib/", "src/lib/"],
  ];
  for (const [from, to] of aliasPrefixes) {
    if (file.path.startsWith(from)) return `${to}${file.path.slice(from.length)}`;
  }
  return null;
}

function assertAllPublicItemsInstalled(fixture, registryDir, names, label) {
  for (const name of names) {
    const item = loadRegistryItem(registryDir, name);
    if (!item) {
      throw new Error(`${label} registry item "${name}" not found at ${registryDir}/${name}.json`);
    }
    for (const file of item.files ?? []) {
      const relative = installedFilePathForFile(file);
      if (!relative) {
        throw new Error(
          `${label} item "${name}" file "${file.path}" has no known install target mapping`,
        );
      }
      if (!existsSync(join(fixture, relative))) {
        throw new Error(`${label} item "${name}" did not install expected file: ${relative}`);
      }
    }
  }
}

// Index names that install as registry:ui (excludes hooks/lib/theme); drives the side-effect imports.
export function uiComponentNames(registryDir, names) {
  return names.filter((name) => loadRegistryItem(registryDir, name)?.type === "registry:ui");
}

// Side-effect imports for the hidden leaf add-ons — their files colocate under subfolders, so the flat
// `@/components/ui/${name}` mapping doesn't apply; derive specifiers from each add-on's installed paths.
export function addonSideEffectImports(registryDir, addonNames) {
  const specifiers = [];
  for (const name of addonNames) {
    for (const file of loadRegistryItem(registryDir, name)?.files ?? []) {
      if (!/\.tsx?$/.test(file.path)) continue;
      const installed = installedFilePathForFile(file);
      if (!installed?.startsWith("src/")) continue;
      specifiers.push(`@/${installed.slice("src/".length).replace(/\.tsx?$/, "")}`);
    }
  }
  return specifiers;
}

// Top-level keys entry hooks land at src/hooks/<name>.ts; utils/ helpers arrive transitively.
export function keysEntryHookNames(keysRegistryDir, keysNames) {
  const hooks = new Set();
  for (const name of keysNames) {
    for (const file of loadRegistryItem(keysRegistryDir, name)?.files ?? []) {
      const installed = installedFilePathForFile(file);
      const hook = installed && /^src\/hooks\/([a-z0-9-]+)\.ts$/.exec(installed)?.[1];
      if (hook) hooks.add(hook);
    }
  }
  return [...hooks];
}

// A standalone keys entry hook nothing in the UI graph imports never enters the Vite build, so a
// bundler-specific resolution/transform failure would escape tsc-only coverage. Derive a `@/hooks/${name}`
// side-effect specifier for each installed keys entry hook that no public UI item imports.
export function standaloneKeysHookImports(keysRegistryDir, keysNames, uiRegistryDir) {
  const importedByUi = new Set();
  for (const name of publicRegistryFileNames(uiRegistryDir)) {
    for (const file of loadRegistryItem(uiRegistryDir, name)?.files ?? []) {
      for (const match of file.content?.matchAll(/@\/hooks\/([a-z0-9-]+)/g) ?? []) {
        importedByUi.add(match[1]);
      }
    }
  }
  return keysEntryHookNames(keysRegistryDir, keysNames)
    .filter((hook) => !importedByUi.has(hook))
    .map((hook) => `@/hooks/${hook}`);
}

// Reads the built app and installed sources from disk (not the registry the import list is derived from)
// so an unwired standalone import, or a derivation that stops covering an installed entry hook, fails loudly.
export function findUnbundledKeysEntryHooks(entryHookNames, appSource, installedUiSources) {
  const importedByUi = new Set();
  for (const source of installedUiSources) {
    for (const match of source.matchAll(/@\/hooks\/([a-z0-9-]+)/g)) importedByUi.add(match[1]);
  }
  return entryHookNames.filter(
    (hook) => !importedByUi.has(hook) && !appSource.includes(`import '@/hooks/${hook}';`),
  );
}

function assertRegistryItemsExist(registryDir, names, label) {
  for (const name of names) {
    if (!loadRegistryItem(registryDir, name)) {
      throw new Error(`${label} registry item "${name}" not found at ${registryDir}/${name}.json`);
    }
  }
}

// Cross-registry check: every r/keys URL dependency must point at a keys item that exists in libs/keys/public/r.
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
  if (localBin) {
    await runArgv(localBin, addArgs, runOptions);
    return;
  }

  await runArgv("pnpm", ["dlx", getWorkspaceShadcnSpec(), ...addArgs], runOptions);
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

// registry:ui components exercised through real JSX below. Every other installed component is bundled via a
// side-effect import so the Vite build catches build-time transform/import failures per item.
export const bundledUiComponents = [
  "button",
  "block-bar",
  "checkbox",
  "command-palette",
  "diff-view",
  "dialog",
  "popover",
  "select",
  "tooltip",
];

export function buildSmokeApp(componentNames, addonImports = []) {
  const figletEntry = addonImports.find((specifier) => specifier.endsWith("/logo/figlet"));
  const sideEffectImports = [
    ...componentNames
      .filter((name) => !bundledUiComponents.includes(name))
      .map((name) => `import '@/components/ui/${name}';`),
    ...addonImports
      .filter((specifier) => !figletEntry || !specifier.includes("/logo/figlet"))
      .map((specifier) => `import '${specifier}';`),
  ];
  const app = joinLines(
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
    ...(figletEntry ? [`import { getFigletText } from '${figletEntry}';`] : []),
    ...sideEffectImports,
    "import './index.css';",
    "",
    ...(figletEntry
      ? [
          "const figletSmoke = Promise.all([",
          "  getFigletText('DG', 'Big'),",
          "  getFigletText('DG', 'Small'),",
          "]);",
          "void figletSmoke.then(([big, small]) => {",
          "  if (!big || !small) throw new Error('Copied logo-figlet returned empty output');",
          "});",
          "",
        ]
      : []),
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
  );
  assertBundledComponentsRendered(app);
  return app;
}

function writeSmokeApp(fixture, componentNames, addonImports = []) {
  writeFileSync(join(fixture, "src/main.tsx"), buildSmokeApp(componentNames, addonImports));
}

function collectBuiltJavaScript(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectBuiltJavaScript(path));
    else if (entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

function assertFigletFontsBundled(fixture) {
  const files = collectBuiltJavaScript(join(fixture, "dist"));
  const unresolved = files.filter((path) =>
    readFileSync(path, "utf8").includes("figlet/importable-fonts/"),
  );
  if (unresolved.length > 0) {
    throw new Error(
      `Copied logo-figlet left browser-unresolvable bare font imports in: ${unresolved.join(", ")}`,
    );
  }

  for (const font of ["Big", "Small"]) {
    if (!files.some((path) => new RegExp(`^${font}-.+\\.js$`).test(basename(path)))) {
      throw new Error(`Copied logo-figlet did not emit a lazy Vite chunk for ${font}`);
    }
  }
}

// Every bundledUiComponents name must render as JSX above; otherwise a dropped usage leaves it neither
// imported nor side-effect bundled — a silent build-coverage gap.
export function assertBundledComponentsRendered(app) {
  for (const name of bundledUiComponents) {
    const tag = name.replace(/(^|-)([a-z])/g, (_match, _sep, char) => char.toUpperCase());
    if (!new RegExp(`<${tag}[\\s/>]`).test(app)) {
      throw new Error(
        `bundledUiComponents lists "${name}" but writeSmokeApp does not render <${tag}> in JSX; add a real usage or remove it from bundledUiComponents`,
      );
    }
  }
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

async function writeShadcnFixture(fixture, baseUrl) {
  writeViteFixture(fixture, {
    name: "shadcn-smoke",
    packageManager: rootPackageManager,
    withLibUtils: true,
    indexCss: ['@import "tailwindcss";', '@import "../styles/styles.css";', '@source ".";', ""],
    componentsJson: true,
    componentRegistries: {
      "@ui": `${baseUrl}/ui/{name}.json`,
      "@diffgazer-keys": `${baseUrl}/keys/{name}.json`,
    },
  });
  await installViteFixtureDeps(root, fixture);
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

async function assertFixtureBuilds(fixture, label, componentNames, addonImports = []) {
  writeSmokeApp(fixture, componentNames, addonImports);
  await runArgv("pnpm", ["run", "typecheck"], fixture);
  await runArgv("pnpm", ["run", "build"], fixture);
  if (addonImports.some((specifier) => specifier.endsWith("/logo/figlet"))) {
    assertFigletFontsBundled(fixture);
  }
  assertBuiltCss(fixture, { label });
}

function readInstalledUiSources(dir) {
  const sources = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      sources.push(...readInstalledUiSources(path));
    } else if (/\.tsx?$/.test(entry.name)) {
      sources.push(readFileSync(path, "utf-8"));
    }
  }
  return sources;
}

// Ground-truth guard: fail if any installed keys entry hook enters the Vite build through neither a
// UI component nor a side-effect import.
function assertKeysEntryHooksBundled(fixture, keysRegistryDir, keysNames) {
  const entryHookNames = keysEntryHookNames(keysRegistryDir, keysNames);
  const appSource = readFileSync(join(fixture, "src/main.tsx"), "utf-8");
  const installedUiSources = readInstalledUiSources(join(fixture, "src/components/ui"));
  const unbundled = findUnbundledKeysEntryHooks(entryHookNames, appSource, installedUiSources);
  if (unbundled.length > 0) {
    throw new Error(
      `Keys entry hooks installed but never bundled by the direct build: ${unbundled.join(", ")}. ` +
        "Import them through a UI component or thread standaloneKeysHookImports into the direct build so the bundler transforms each one.",
    );
  }
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

  try {
    // Install EVERY directly-installable public item through direct registry URLs, not a subset: a static
    // closure resolving is not the same as `shadcn add` writing files and rewriting imports.
    await writeShadcnFixture(directFixture, registryServer.baseUrl);
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
    await writeShadcnFixture(namespaceFixture, registryServer.baseUrl);
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
    await writeShadcnFixture(soloFixture, registryServer.baseUrl);
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
  } finally {
    await registryServer.close();
    rmSync(directFixture, { recursive: true, force: true });
    rmSync(namespaceFixture, { recursive: true, force: true });
    rmSync(soloFixture, { recursive: true, force: true });
  }

  console.log("OK: shadcn direct-install smoke passed");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runSmoke();
}
