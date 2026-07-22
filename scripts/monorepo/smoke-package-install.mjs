#!/usr/bin/env node

// Exit-code contract: this smoke runner exits non-zero when a check fails. A
// failed assertion throws, which Node surfaces as a non-zero exit; temp-project
// cleanup runs inside withTempPackageProject's try/finally before the throw
// propagates. Do not swap the throws for process.exit() — that would bypass the
// finally cleanup and leak temp project directories.

import {
  writeKeysPackageModeSmoke,
  writeKeysTestHelperSmoke,
} from "./smoke-keys-package-fixtures.mjs";
import {
  verifyUiNextPackageSmoke,
  verifyUiVitePackageSmoke,
  writeUiCommonImportSmoke,
  writeUiKeysAbsentSmoke,
  writeUiNextPackageSmoke,
  writeUiPackageModeSmoke,
  writeUiVitePackageSmoke,
} from "./smoke-ui-package-fixtures.mjs";
import { shouldRunPackageSmoke, withTempPackageProject } from "./smoke-package-runner.mjs";

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
  // Runs first so the keys required-peer signal is proven before any
  // keys-installing fixture; it does not depend on a built keys package. Asserts a
  // package consumer who skips the required @diffgazer/keys peer still gets keys-free
  // entries, and that keys-backed subpaths fail at load naming the missing peer.
  {
    name: "@diffgazer/ui",
    label: "@diffgazer/ui without @diffgazer/keys (required peer missing signal)",
    skipPeerAutoInstall: true,
    installDeps: ["react@^19.2.0", "react-dom@^19.2.0"],
    prepare: (projectDir) => writeUiKeysAbsentSmoke(projectDir),
    steps: [step("node", "keys-absent.mjs")],
    expect: /OK: keys-free @diffgazer\/ui entries work without @diffgazer\/keys/,
  },
  {
    name: "@diffgazer/ui",
    label: "@diffgazer/ui common imports",
    workspaceDeps: ["@diffgazer/keys"],
    installDeps: ["react@^19.2.0", "react-dom@^19.2.0"],
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
    expect:
      /OK: imported .* @diffgazer\/ui exports and resolved package CSS[\s\S]*OK: @diffgazer\/ui SSR render[\s\S]*OK: Vite package-mode Tailwind CSS output/,
  },
  {
    name: "@diffgazer/keys",
    label: "@diffgazer/keys runtime-only consumer",
    skipPeerAutoInstall: true,
    installDeps: ["react@^19.2.0", "@types/react@^19.2.0", "typescript@^5.9.0"],
    prepare: writeKeysPackageModeSmoke,
    steps: [step("node", "runtime-only.mjs"), step("pnpm", "exec", "tsc", "-p", "tsconfig.json")],
    expect: /OK: @diffgazer\/keys root works without optional test peers/,
  },
  {
    name: "@diffgazer/keys",
    label: "@diffgazer/keys Vitest navigation helper",
    installDeps: [
      "react@^19.2.0",
      "react-dom@^19.2.0",
      "@testing-library/react@^16.3.2",
      "@testing-library/user-event@^14.6.1",
      "vitest@^4.1.0",
    ],
    prepare: writeKeysTestHelperSmoke,
    steps: [step("pnpm", "exec", "vitest", "run", "helper-import.test.mjs")],
    verify: () => "OK: @diffgazer/keys testing helper works after documented peers",
    expect: /OK: @diffgazer\/keys testing helper works after documented peers/,
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
    // `diffgazer --help` exits before touching dist/web, so a build that drops the
    // embedded SPA would otherwise ship silently. Assert the tarball ships it.
    assertTarball: (files) => {
      if (!files.includes("dist/web/index.html")) {
        throw new Error("diffgazer tarball is missing the embedded SPA entry dist/web/index.html");
      }
    },
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

  const result = await withTempPackageProject(root, item.name, item);
  console.log(result);
  assertSmoke(item.name, result, item.expect);
}

console.log("OK: package install smoke tests passed");
