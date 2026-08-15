import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runArgv } from "../smoke-shared/command.mjs";
import { installViteFixtureDeps } from "../smoke-shared/dependencies.mjs";
import {
  assertBuiltCss,
  DEFAULT_FIXTURE_ALIASES,
  fixtureEntryPath,
  joinLines,
  writeViteFixture,
} from "../smoke-shared/fixtures.mjs";

// shadcn resolves every install target from the components.json alias set and
// from whether the project has a `src/` directory, and derives `ui`/`lib`/
// `hooks` from `components`/`utils` when those optional keys are absent. The
// other fixtures all run the default cell, so a public registry item that only
// resolves under the defaults installs green today. One fixture per resolver
// branch; the checkbox closure spans all four target kinds (registry:ui,
// registry:lib, a keys registry:hook, and the transitive theme registry:style).
const MATRIX_CELLS = [
  {
    label: "non-default components, lib, and hooks aliases",
    prefix: "shadcn-smoke-alias-matrix-",
    isSrcDir: true,
    aliases: {
      components: "@/app/parts",
      utils: "@/app/support/cn",
      ui: "@/app/parts/ui",
      lib: "@/app/support",
      hooks: "@/app/keyboard",
    },
    installed: [
      "src/app/parts/ui/checkbox/checkbox.tsx",
      "src/app/keyboard/use-navigation.ts",
      "src/app/keyboard/utils/focusable.ts",
      "src/app/support/aria.ts",
    ],
  },
  {
    label: "optional ui, lib, and hooks aliases omitted",
    prefix: "shadcn-smoke-alias-defaults-",
    isSrcDir: true,
    aliases: { components: "@/components", utils: "@/lib/utils" },
    installed: [
      "src/components/ui/checkbox/checkbox.tsx",
      "src/hooks/use-navigation.ts",
      "src/hooks/utils/focusable.ts",
      "src/lib/aria.ts",
    ],
  },
  {
    label: "root layout project without src/",
    prefix: "shadcn-smoke-root-layout-",
    isSrcDir: false,
    aliases: DEFAULT_FIXTURE_ALIASES,
    installed: [
      "components/ui/checkbox/checkbox.tsx",
      "hooks/use-navigation.ts",
      "hooks/utils/focusable.ts",
      "lib/aria.ts",
    ],
  },
];

function uiAliasOf(aliases) {
  return aliases.ui ?? `${aliases.components}/ui`;
}

function indexCssFor(isSrcDir) {
  return isSrcDir
    ? ['@import "tailwindcss";', '@import "../styles/styles.css";', '@source ".";', ""]
    : [
        '@import "tailwindcss";',
        '@import "./styles/styles.css";',
        '@source "./main.tsx";',
        '@source "./components";',
        "",
      ];
}

function writeMatrixApp(fixture, { aliases, isSrcDir }) {
  writeFileSync(
    resolve(fixture, fixtureEntryPath(isSrcDir)),
    joinLines(
      "import React from 'react';",
      "import { createRoot } from 'react-dom/client';",
      `import { Checkbox } from '${uiAliasOf(aliases)}/checkbox';`,
      "import './index.css';",
      "",
      "function App() {",
      "  return (",
      '    <main className="min-h-screen bg-background text-foreground p-6">',
      '      <Checkbox defaultChecked label="Matrix Checkbox" />',
      "    </main>",
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ),
  );
}

function assertInstalledPaths(fixture, cell) {
  const missing = cell.installed.filter((path) => !existsSync(resolve(fixture, path)));
  if (missing.length > 0) {
    throw new Error(
      `shadcn install under ${cell.label} did not write: ${missing.join(", ")}. ` +
        "The public registry targets must resolve against the configured aliases and project layout.",
    );
  }
}

export async function runComponentsJsonMatrixSmoke({
  root,
  baseUrl,
  rootPackageManager,
  addItems,
}) {
  for (const cell of MATRIX_CELLS) {
    const fixture = mkdtempSync(join(tmpdir(), cell.prefix));
    try {
      writeViteFixture(fixture, {
        name: `shadcn-smoke-${cell.prefix.replace(/^shadcn-smoke-|-$/g, "")}`,
        packageManager: rootPackageManager,
        withLibUtils: true,
        indexCss: indexCssFor(cell.isSrcDir),
        componentsJson: true,
        aliases: cell.aliases,
        isSrcDir: cell.isSrcDir,
      });
      await installViteFixtureDeps(root, fixture);
      await addItems(fixture, [`${baseUrl}/ui/checkbox.json`]);

      assertInstalledPaths(fixture, cell);
      writeMatrixApp(fixture, cell);
      await runArgv("pnpm", ["run", "typecheck"], fixture);
      await runArgv("pnpm", ["run", "build"], fixture);
      assertBuiltCss(fixture, {
        label: `Built ${cell.label}`,
        // Checkbox-only install: the theme token layer plus a utility Tailwind
        // can only emit by scanning the copied component source at its
        // alias-resolved path.
        expected: ["--base-bg", "sr-only"],
      });
      console.log(`OK: public registry installs and builds under ${cell.label}`);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }
}
