import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertBuiltCss, joinLines, uiSmokeAppBody, writeNextFixture } from "./smoke-shared.mjs";

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
    joinLines(
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
      "import { Dialog, DialogContent, DialogTitle } from '@diffgazer/ui/components/dialog';",
      "import { Popover, PopoverTrigger, PopoverContent } from '@diffgazer/ui/components/popover';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@diffgazer/ui/components/select';",
      "import { CommandPalette, CommandPaletteContent, CommandPaletteInput, CommandPaletteList, CommandPaletteItem } from '@diffgazer/ui/components/command-palette';",
      "import { Toaster } from '@diffgazer/ui/components/toast';",
      "import { Tooltip } from '@diffgazer/ui/components/tooltip';",
      `const exports = ${JSON.stringify(exports, null, 2)};`,
      ...uiImportLoopBody(),
      "require.resolve('@diffgazer/ui/sources.css');",
      "require.resolve('@diffgazer/ui/styles.css');",
      "console.log(`OK: imported ${exports.length} @diffgazer/ui exports and resolved package CSS`);",
      "",
    ),
  );
  writeFileSync(
    resolve(projectDir, "ssr.mjs"),
    joinLines(
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
    ),
  );
  writeFileSync(
    resolve(projectDir, "strict.ts"),
    joinLines(
      ...exports.map((exportPath, index) => `type UiExport${index} = typeof import(${JSON.stringify(exportPath)});`),
      "import { Button } from '@diffgazer/ui/components/button';",
      "import type { ButtonProps } from '@diffgazer/ui/components/button';",
      "import { useKey } from '@diffgazer/keys';",
      `type UiExportCount = ${exports.map((_, index) => `UiExport${index}`).join(" | ")};`,
      "const ButtonRef = Button;",
      "const props = { variant: 'primary' } satisfies ButtonProps;",
      "declare const uiExportCount: UiExportCount;",
      "void ButtonRef;",
      "void props;",
      "void uiExportCount;",
      "void useKey;",
      "",
    ),
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
    joinLines(
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
      `const exports = ${JSON.stringify(exports, null, 2)};`,
      ...uiImportLoopBody(),
      "require.resolve('@diffgazer/ui/sources.css');",
      "require.resolve('@diffgazer/ui/styles.css');",
      "console.log(`OK: imported ${exports.length} common @diffgazer/ui exports`);",
      "",
    ),
  );
  // Model the realistic consumer scenario for the optional figlet peer:
  // a project that imports @diffgazer/ui without installing figlet. pnpm 10
  // defaults auto-install-peers=true, which silently pulls figlet into the
  // fixture and hides the documented missing-peer failure path. Drop the
  // symlink so the getFigletText() call inside uiImportLoopBody actually
  // exercises and asserts the "optional peer dependency" rejection.
  rmSync(resolve(projectDir, "node_modules/figlet"), { recursive: true, force: true });
}

/**
 * Models a consumer who installs @diffgazer/ui WITHOUT the optional
 * @diffgazer/keys peer (HANDOFF-1 / DECISION-1: keys must stay optional). Two
 * contracts are asserted:
 *   1. A keys-free component (Button) imports and SSR-renders with no keys present.
 *   2. A keys-backed subpath (select) fails at import with a native
 *      ERR_MODULE_NOT_FOUND that names "@diffgazer/keys" — the actionable signal
 *      a consumer needs to know which optional peer to install. It cannot be a
 *      figlet-style custom-message lazy load: the keys exports are React hooks
 *      (cannot be dynamically imported and called conditionally) and the copy-mode
 *      import rewriter is anchored to the static import form, so the import stays
 *      static and the failure is the native resolver error.
 *
 * pnpm 10 defaults auto-install-peers=true and may hoist @diffgazer/keys into the
 * fixture; the keys removal in writeUiKeysAbsentSmoke drops it so the keys-backed
 * import genuinely fails.
 */
function uiKeysAbsentBody() {
  return [
    "import { createRequire } from 'node:module';",
    "import { renderToString } from 'react-dom/server';",
    "import React from 'react';",
    "import { Button } from '@diffgazer/ui/components/button';",
    "",
    "const require = createRequire(import.meta.url);",
    "const html = renderToString(React.createElement(Button, { variant: 'primary' }, 'Save'));",
    "if (!html.includes('Save')) {",
    "  throw new Error(`Expected keys-free Button SSR to render 'Save'; got: ${html}`);",
    "}",
    "",
    "// Prove the optional peer is genuinely absent first. Without this, an",
    "// ERR_MODULE_NOT_FOUND naming '@diffgazer/keys' could also be raised by a",
    "// keys package that IS installed but internally references a broken path,",
    "// since that path contains the same '@diffgazer/keys' substring. Asserting",
    "// the package is unresolvable makes the failure below mean 'peer absent'.",
    "let keysResolved;",
    "try { keysResolved = require.resolve('@diffgazer/keys'); } catch { keysResolved = null; }",
    "if (keysResolved) {",
    "  throw new Error(`Expected @diffgazer/keys to be absent, but it resolved to ${keysResolved}`);",
    "}",
    "",
    "let caught;",
    "try { await import('@diffgazer/ui/components/select'); } catch (error) { caught = error; }",
    "if (!caught) {",
    "  throw new Error('Expected importing a keys-backed subpath without @diffgazer/keys to fail');",
    "}",
    "if (caught.code !== 'ERR_MODULE_NOT_FOUND') {",
    "  throw new Error(`Expected ERR_MODULE_NOT_FOUND; got code ${caught.code}: ${caught.message}`);",
    "}",
    "if (!String(caught.message).includes('@diffgazer/keys')) {",
    "  throw new Error(`Expected the failure to name '@diffgazer/keys'; got: ${caught.message}`);",
    "}",
    "console.log('OK: @diffgazer/ui works without @diffgazer/keys; keys-backed subpath fails naming the missing peer');",
    "",
  ];
}

export function writeUiKeysAbsentSmoke(projectDir) {
  writeFileSync(resolve(projectDir, "keys-absent.mjs"), uiKeysAbsentBody().join("\n"));
  // Drop any auto-installed/hoisted keys so the keys-backed import truly fails.
  rmSync(resolve(projectDir, "node_modules/@diffgazer/keys"), { recursive: true, force: true });
}

export function writeUiVitePackageSmoke(projectDir) {
  mkdirSync(resolve(projectDir, "src"), { recursive: true });
  writeFileSync(
    resolve(projectDir, "index.html"),
    `<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n`,
  );
  writeFileSync(
    resolve(projectDir, "src/index.css"),
    joinLines(
      '@import "tailwindcss";',
      '@import "@diffgazer/ui/sources.css";',
      '@import "@diffgazer/ui/styles.css";',
      '@source ".";',
      "",
    ),
  );
  writeFileSync(
    resolve(projectDir, "src/main.tsx"),
    joinLines(
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
    ),
  );
  writeFileSync(
    resolve(projectDir, "vite.config.mjs"),
    joinLines(
      "import { defineConfig } from 'vite';",
      "import react from '@vitejs/plugin-react';",
      "import tailwindcss from '@tailwindcss/vite';",
      "",
      "export default defineConfig({",
      "  plugins: [react(), tailwindcss()],",
      "});",
      "",
    ),
  );
}

export function writeUiNextPackageSmoke(_root, projectDir) {
  writeNextFixture(projectDir, { name: "diffgazer-ui-next-smoke" });
  writeFileSync(
    resolve(projectDir, "app/globals.css"),
    joinLines(
      '@import "tailwindcss";',
      '@import "@diffgazer/ui/sources.css";',
      '@import "@diffgazer/ui/styles.css";',
      '@source ".";',
      "",
    ),
  );
  writeFileSync(
    resolve(projectDir, "app/layout.tsx"),
    joinLines(
      "import './globals.css';",
      "import type { ReactNode } from 'react';",
      "",
      "export default function RootLayout({ children }: { children: ReactNode }) {",
      "  return <html lang=\"en\"><body>{children}</body></html>;",
      "}",
      "",
    ),
  );
  writeFileSync(
    resolve(projectDir, "app/page.tsx"),
    joinLines(
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
    ),
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
    joinLines(
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
    ),
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
