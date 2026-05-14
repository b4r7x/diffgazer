#!/usr/bin/env node

import {
  writeKeysPackageModeSmoke,
  writeUiCommonImportSmoke,
  writeUiNextPackageSmoke,
  writeUiPackageModeSmoke,
  writeUiVitePackageSmoke,
  verifyUiNextPackageSmoke,
  verifyUiVitePackageSmoke,
} from "./smoke-package-fixtures.mjs";
import {
  shouldRunPackageSmoke,
  withTempPackageProject,
} from "./smoke-package-runner.mjs";

const root = process.cwd();

function step(command, ...args) {
  return { command, args };
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
    prepare: (projectDir) => writeUiCommonImportSmoke(root, projectDir),
    steps: [step("node", "common-imports.mjs")],
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
    prepare(projectDir) {
      writeUiPackageModeSmoke(root, projectDir);
      writeUiVitePackageSmoke(projectDir);
    },
    steps: [
      step("node", "import-all.mjs"),
      step("node", "ssr.mjs"),
      step("pnpm", "exec", "tsc", "-p", "tsconfig.json"),
      step("pnpm", "exec", "tsc", "-p", "tsconfig.bundler.json"),
      step("pnpm", "exec", "vite", "build"),
    ],
    verify: verifyUiVitePackageSmoke,
    expect: /OK: imported .* @diffgazer\/ui exports and resolved package CSS[\s\S]*OK: @diffgazer\/ui SSR render[\s\S]*OK: Vite package-mode Tailwind CSS output/,
  },
  {
    name: "@diffgazer/keys",
    installDeps: [
      "react@^19.2.0",
      "@types/react@^19.2.0",
      "typescript@^5.9.0",
    ],
    prepare: writeKeysPackageModeSmoke,
    steps: [
      step(
        "node",
        "-e",
        "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); require.resolve('@diffgazer/keys/package.json'); import('@diffgazer/keys').then(()=>console.log('OK: @diffgazer/keys import and package.json export')).catch((e)=>{console.error(e); process.exit(1);});",
      ),
      step("pnpm", "exec", "tsc", "-p", "tsconfig.json"),
    ],
    expect: /OK: @diffgazer\/keys import and package\.json export/,
  },
  {
    name: "@diffgazer/ui",
    label: "@diffgazer/ui Next package-mode CSS",
    workspaceDeps: ["@diffgazer/keys"],
    optionalWhenDepsMissing: true,
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
    prepare: (projectDir) => writeUiNextPackageSmoke(root, projectDir),
    steps: [step("pnpm", "exec", "next", "build", "--webpack")],
    verify: verifyUiNextPackageSmoke,
    expect: /OK: Next package-mode Tailwind CSS output/,
  },
  {
    name: "diffgazer",
    steps: [step("pnpm", "exec", "diffgazer", "--help")],
    expect: /Usage:|Diffgazer|diffgazer/i,
  },
  {
    name: "@diffgazer/add",
    steps: [step("pnpm", "exec", "dgadd", "--help")],
    expect: /Usage: dgadd|Install Diffgazer UI/i,
  },
];

for (const item of packages) {
  if (!shouldRunPackageSmoke(root, item)) continue;

  const result = withTempPackageProject(root, item.name, item);
  console.log(result);
  assertSmoke(item.name, result, item.expect);
}

console.log("OK: package install smoke tests passed");
