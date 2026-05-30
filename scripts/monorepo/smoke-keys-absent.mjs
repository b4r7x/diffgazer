#!/usr/bin/env node

// Standalone runner for the keys-absent fixture (HANDOFF-1 / DECISION-1): proves
// @diffgazer/ui installs and runs WITHOUT the optional @diffgazer/keys peer, and
// that importing a keys-backed subpath fails with a signal naming the missing
// package. Runnable on its own so the contract can be verified independently of
// the keys-installing fixtures in smoke-package-install.mjs (which need a built
// @diffgazer/keys). Exits non-zero if the contract is not met.

import { writeUiKeysAbsentSmoke } from "./smoke-package-fixtures.mjs";
import { withTempPackageProject } from "./smoke-package-runner.mjs";

const item = {
  name: "@diffgazer/ui",
  label: "@diffgazer/ui without @diffgazer/keys (optional peer)",
  installDeps: ["react@^19.2.0", "react-dom@^19.2.0"],
  prepare: (projectDir) => writeUiKeysAbsentSmoke(projectDir),
  steps: [{ command: "node", args: ["keys-absent.mjs"] }],
  expect: /OK: @diffgazer\/ui works without @diffgazer\/keys/,
};

const result = withTempPackageProject(process.cwd(), item.name, item);
console.log(result);

if (!item.expect.test(result)) {
  throw new Error(`keys-absent smoke failed: expected ${item.expect}, got ${result.slice(0, 300)}`);
}

console.log("OK: keys-absent smoke passed");
