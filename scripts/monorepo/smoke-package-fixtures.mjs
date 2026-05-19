import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertBuiltCss, uiSmokeAppBody, writeNextFixture } from "./smoke-shared.mjs";

const UI_FIGLET_EXPORT = "@diffgazer/ui/components/logo/figlet";

function getPackageExports(root, packageDir, packageName) {
  const pkg = JSON.parse(readFileSync(resolve(root, packageDir, "package.json"), "utf-8"));
  return Object.keys(pkg.exports ?? {})
    .filter((exportPath) => exportPath !== ".")
    .filter((exportPath) => !exportPath.endsWith(".css") && exportPath !== "./package.json")
    .map((exportPath) => `${packageName}${exportPath.slice(1)}`)
    .sort();
}

/**
 * Emits an mjs import loop that exercises every UI export. The figlet subpath
 * loads lazily, so the bare import must always succeed; the missing-peer
 * failure surfaces only when getFigletText() is called. When figlet is NOT
 * installed, this asserts that getFigletText() rejects with a message naming
 * the optional peer dependency. When figlet IS installed (e.g. pnpm's
 * autoInstallPeers picked it up), the bare import alone is enough.
 */
function uiImportLoopBody() {
  return [
    `const FIGLET_EXPORT = ${JSON.stringify(UI_FIGLET_EXPORT)};`,
    "let figletInstalled = true;",
    "try { require.resolve('figlet'); } catch { figletInstalled = false; }",
    "for (const exportPath of exports) {",
    "  const mod = await import(exportPath);",
    "  if (exportPath !== FIGLET_EXPORT) continue;",
    "  if (typeof mod.getFigletText !== 'function') {",
    "    throw new Error(`Expected getFigletText export from ${FIGLET_EXPORT}`);",
    "  }",
    "  if (figletInstalled) continue;",
    "  let caught;",
    "  try { await mod.getFigletText('TEST'); } catch (error) { caught = error; }",
    "  if (!caught) {",
    "    throw new Error(`Expected getFigletText() to reject when figlet is not installed`);",
    "  }",
    "  const message = String(caught?.message ?? caught);",
    "  if (!message.includes('optional peer dependency')) {",
    "    throw new Error(`Expected error message to include \"optional peer dependency\"; got: ${message}`);",
    "  }",
    "}",
  ];
}

export function writeUiPackageModeSmoke(root, projectDir) {
  const exports = getPackageExports(root, "libs/ui", "@diffgazer/ui");
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
      ...uiImportLoopBody(),
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
      "declare const uiExportCount: UiExportCount;",
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

export function writeUiCommonImportSmoke(root, projectDir) {
  const exports = getPackageExports(root, "libs/ui", "@diffgazer/ui");
  writeFileSync(
    resolve(projectDir, "common-imports.mjs"),
    [
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
      "const exports = " + JSON.stringify(exports, null, 2) + ";",
      ...uiImportLoopBody(),
      "require.resolve('@diffgazer/ui/sources.css');",
      "require.resolve('@diffgazer/ui/styles.css');",
      "console.log(`OK: imported ${exports.length} common @diffgazer/ui exports`);",
      "",
    ].join("\n"),
  );
  // Model the realistic consumer scenario for the optional figlet peer:
  // a project that imports @diffgazer/ui without installing figlet. pnpm 10
  // defaults auto-install-peers=true, which silently pulls figlet into the
  // fixture and hides the documented missing-peer failure path. Drop the
  // symlink so the getFigletText() call inside uiImportLoopBody actually
  // exercises and asserts the "optional peer dependency" rejection.
  rmSync(resolve(projectDir, "node_modules/figlet"), { recursive: true, force: true });
}

export function writeUiVitePackageSmoke(projectDir) {
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
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogCloseIcon } from '@diffgazer/ui/components/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@diffgazer/ui/components/select';",
      "import './index.css';",
      "",
      "function App() {",
      "  return (",
      ...uiSmokeAppBody("Package"),
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
}

export function writeUiNextPackageSmoke(root, projectDir) {
  writeNextFixture(projectDir, { name: "diffgazer-ui-next-smoke" });
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
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogCloseIcon } from '@diffgazer/ui/components/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@diffgazer/ui/components/select';",
      "",
      "export default function Page() {",
      "  return (",
      ...uiSmokeAppBody("Package"),
      "  );",
      "}",
      "",
    ].join("\n"),
  );
}

export function verifyUiVitePackageSmoke(projectDir) {
  assertBuiltCss(projectDir, { label: "Vite package-mode" });
  return "OK: Vite package-mode Tailwind CSS output";
}

export function verifyUiNextPackageSmoke(projectDir) {
  assertBuiltCss(projectDir, { outputDir: ".next", label: "Next package-mode" });
  return "OK: Next package-mode Tailwind CSS output";
}

export function writeKeysPackageModeSmoke(projectDir) {
  writeFileSync(
    resolve(projectDir, "strict.ts"),
    [
      "import { createRef, type ComponentProps } from 'react';",
      "import { KeyboardProvider, useActionRowNavigation, useFocusTrap, useKey, useNavigation, useScope } from '@diffgazer/keys';",
      "",
      "type ProviderProps = ComponentProps<typeof KeyboardProvider>;",
      "const providerProps = { children: null } satisfies ProviderProps;",
      "",
      "function HookSmoke() {",
      "  const containerRef = createRef<HTMLDivElement>();",
      "  useScope('smoke');",
      "  useKey('mod+k', () => undefined);",
      "  useNavigation({ containerRef, role: 'option' });",
      "  useFocusTrap(containerRef, { enabled: false });",
      "  useActionRowNavigation({ enabled: true, actionCount: 1, onAction: () => undefined });",
      "  return null;",
      "}",
      "",
      "void providerProps;",
      "void HookSmoke;",
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
