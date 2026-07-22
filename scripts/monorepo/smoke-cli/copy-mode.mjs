import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runArgv } from "../smoke-shared/command.mjs";
import {
  declareTailwindV4Dependency,
  installViteFixtureDeps,
  packageNameFromSpec,
  pnpmAddFlags,
  resolveAndCollectMissing,
  resolveLocalDependency as resolveWorkspaceDependency,
  skipMissingSmokeDeps,
} from "../smoke-shared/dependencies.mjs";
import {
  assertBuiltCss,
  joinLines,
  uiSmokeAppBody,
  writeNextFixture,
  writeViteFixture,
} from "../smoke-shared/fixtures.mjs";
import { networkAllowed } from "../smoke-shared/network.mjs";

function missingLocalDeps(root, deps) {
  return resolveAndCollectMissing(deps, (dep) => resolveWorkspaceDependency(root, dep));
}

async function installDeps(root, fixture, depSpecs) {
  const deps = networkAllowed()
    ? depSpecs
    : depSpecs.map((dep) => resolveWorkspaceDependency(root, packageNameFromSpec(dep) ?? dep));
  await runArgv("pnpm", ["add", ...pnpmAddFlags(), ...deps], fixture);
  if (depSpecs.some((dep) => packageNameFromSpec(dep) === "tailwindcss")) {
    declareTailwindV4Dependency(fixture);
  }
}

function writeNextCopyFirstApp(fixture) {
  writeFileSync(
    join(fixture, "app/globals.css"),
    joinLines(
      '@import "tailwindcss";',
      '@import "../src/styles/styles.css";',
      '@source "../src";',
      "",
    ),
  );
  writeFileSync(
    join(fixture, "app/layout.tsx"),
    joinLines(
      "import './globals.css';",
      "import type { ReactNode } from 'react';",
      "",
      "export default function RootLayout({ children }: { children: ReactNode }) {",
      '  return <html lang="en"><body>{children}</body></html>;',
      "}",
      "",
    ),
  );
  writeFileSync(
    join(fixture, "app/page.tsx"),
    joinLines(
      "'use client';",
      "",
      "import { Button } from '@/components/ui/button';",
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogCloseIcon } from '@/components/ui/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      "",
      "export default function Page() {",
      "  return (",
      ...uiSmokeAppBody("Copy"),
      "  );",
      "}",
      "",
    ),
  );
}

function writeCopyFirstApp(fixture) {
  writeFileSync(
    join(fixture, "src/index.css"),
    joinLines('@import "tailwindcss";', '@import "./styles/styles.css";', '@source ".";', ""),
  );
  writeFileSync(
    join(fixture, "src/main.tsx"),
    joinLines(
      "import React, { useRef } from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import { Button } from '@/components/ui/button';",
      "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogCloseIcon } from '@/components/ui/dialog';",
      "import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';",
      // Exercise the rewritten copy-mode hook: in copy mode dgadd rewrites
      // keys/navigation's `@diffgazer/keys` imports to this local path. Importing
      // and calling it proves the rewrite produces a consumable hook, not just a
      // file that happens to type-check unused.
      "import { useNavigation } from '@/hooks/use-navigation';",
      "import './index.css';",
      "",
      "function App() {",
      "  const containerRef = useRef<HTMLDivElement>(null);",
      "  useNavigation({ containerRef, role: 'option' });",
      "  return (",
      ...uiSmokeAppBody("Copy"),
      "  );",
      "}",
      "",
      "createRoot(document.getElementById('root')!).render(<App />);",
      "",
    ),
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
    throw new Error(
      "Copy-first dialog CSS should be aggregated into src/styles/styles.css, not copied as a component file",
    );
  }
  if (!styles.includes("dialog::backdrop")) {
    throw new Error("Copy-first styles.css does not include dialog global CSS");
  }
}

async function runOptionalNextCopyFirstSmoke(root, dgaddBin) {
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
      root,
      nextDeps.map((dep) => packageNameFromSpec(dep)).filter(Boolean),
    );
    if (skipMissingSmokeDeps("dgadd Next copy-first build", missing)) {
      return;
    }
  }

  const fixture = mkdtempSync(join(tmpdir(), "dgadd-next-smoke-"));
  try {
    writeNextFixture(fixture, { root, withSrc: true, paths: true });
    await installDeps(root, fixture, nextDeps);
    await runArgv("node", [dgaddBin, "init", "--cwd", fixture, "--yes", "--skip-install"]);
    await runArgv("node", [
      dgaddBin,
      "add",
      "ui/button",
      "ui/dialog",
      "ui/select",
      "ui/form-reset",
      "--cwd",
      fixture,
      "--yes",
      "--skip-install",
    ]);
    assertCopyFirstCssInstall(fixture);
    writeNextCopyFirstApp(fixture);
    await runArgv("pnpm", ["exec", "next", "build", "--webpack"], fixture);
    assertBuiltCss(fixture, { outputDir: ".next", label: "Built copy-first" });
    console.log("OK: dgadd Next copy-first build flow");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

export async function runCopyModeSmoke({ root, dgaddBin }) {
  const fixture = mkdtempSync(join(tmpdir(), "dgadd-smoke-"));
  try {
    writeViteFixture(fixture);
    await installViteFixtureDeps(root, fixture);

    await runArgv("node", [dgaddBin, "init", "--cwd", fixture, "--yes", "--skip-install"]);
    await runArgv("node", [
      dgaddBin,
      "add",
      "ui/button",
      "ui/dialog",
      "ui/select",
      "ui/checkbox",
      "ui/radio",
      "ui/toggle-group",
      "ui/form-reset",
      "keys/navigation",
      "--cwd",
      fixture,
      "--yes",
      "--skip-install",
    ]);
    assertCopyFirstCssInstall(fixture);
    if (!existsSync(join(fixture, "src/lib/selectable-collection.ts"))) {
      throw new Error("selectable-collection helper was not copied for selectable UI components");
    }
    writeCopyFirstApp(fixture);
    await runArgv("node", [dgaddBin, "list", "--installed", "--json", "--cwd", fixture]);
    await runArgv("node", [dgaddBin, "diff", "--cwd", fixture]);
    await runArgv("pnpm", ["run", "typecheck"], fixture);
    await runArgv("pnpm", ["run", "build"], fixture);
    assertBuiltCss(fixture, { label: "Built copy-first" });
    const removeOutput = await runArgv("node", [
      dgaddBin,
      "remove",
      "keys/navigation",
      "--cwd",
      fixture,
      "--yes",
    ]);

    if (!/Keeping keys\/navigation/.test(removeOutput)) {
      throw new Error(
        `keys/navigation removal was not clearly blocked. Output: ${removeOutput.slice(0, 250)}`,
      );
    }

    const config = JSON.parse(readFileSync(join(fixture, "diffgazer.json"), "utf-8"));
    if (!config.installedComponents?.["keys/navigation"]) {
      throw new Error(
        "keys/navigation manifest entry was removed while copy-mode UI still depends on it",
      );
    }
    if (!existsSync(join(fixture, "src/hooks/use-navigation.ts"))) {
      throw new Error("keys/navigation hook was removed while copy-mode UI still depends on it");
    }
    await runArgv("pnpm", ["run", "typecheck"], fixture);
    await runArgv("pnpm", ["run", "build"], fixture);
    console.log("OK: dgadd copy-first init/add/list/diff/remove typecheck/build flow");
    await runOptionalNextCopyFirstSmoke(root, dgaddBin);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
