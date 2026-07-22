import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { runArgv } from "../smoke-shared/command.mjs";
import { installViteFixtureDeps } from "../smoke-shared/dependencies.mjs";
import { assertBuiltCss, joinLines, writeViteFixture } from "../smoke-shared/fixtures.mjs";
import { findUnbundledKeysEntryHooks, keysEntryHookNames } from "./registry.mjs";

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

export async function writeShadcnFixture(fixture, baseUrl, root, rootPackageManager) {
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

export function assertInstalledRegistryTree(fixture) {
  assertFileContains(fixture, "src/hooks/use-navigation.ts", ["useNavigation"]);
  assertFileContains(fixture, "src/components/ui/checkbox/checkbox-group.tsx", [
    "@/hooks/use-navigation",
  ]);
  assertFileContains(fixture, "src/hooks/use-focus-trap.ts", ["useFocusTrap"]);
  assertFileContains(fixture, "src/components/ui/select/use-content-navigation.ts", [
    "@/hooks/use-navigation",
  ]);
  assertFileContains(fixture, "src/components/ui/select/select-content.tsx", [
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
  assertFileContains(fixture, "src/components/ui/popover/use-content-dismissal.ts", [
    "@/hooks/use-outside-click",
  ]);
  assertFileContains(fixture, "src/components/ui/popover/popover-content.tsx", [
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

export async function assertFixtureBuilds(fixture, label, componentNames, addonImports = []) {
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
export function assertKeysEntryHooksBundled(fixture, keysRegistryDir, keysNames) {
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

export function writeSoloButtonApp(fixture) {
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

export function assertThemeFilesInstalled(fixture) {
  for (const relative of ["styles/theme-base.css", "styles/theme.css", "styles/styles.css"]) {
    if (!existsSync(join(fixture, relative))) {
      throw new Error(`Expected theme file missing after solo install: ${relative}`);
    }
  }
}
