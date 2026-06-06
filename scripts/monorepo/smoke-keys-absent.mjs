#!/usr/bin/env node

// Standalone runner for the keys-absent fixture (T-608/F-234): @diffgazer/keys is
// a REQUIRED peer for package mode, so this proves that a consumer who skips it
// still gets keys-free entries (Button) AND that importing a keys-backed subpath
// fails at load with a signal naming the missing required peer. Runnable on its
// own so the contract can be verified independently of the keys-installing fixtures
// in smoke-package-install.mjs (which need a built @diffgazer/keys). Exits non-zero
// if the contract is not met.

import { writeUiKeysAbsentSmoke } from "./smoke-package-fixtures.mjs";
import { withTempPackageProject } from "./smoke-package-runner.mjs";

const item = {
  name: "@diffgazer/ui",
  label: "@diffgazer/ui without @diffgazer/keys (required peer missing signal)",
  skipPeerAutoInstall: true,
  installDeps: ["react@^19.2.0", "react-dom@^19.2.0"],
  prepare: (projectDir) => writeUiKeysAbsentSmoke(projectDir),
  steps: [{ command: "node", args: ["keys-absent.mjs"] }],
  expect: /OK: keys-free @diffgazer\/ui entries work without @diffgazer\/keys/,
};

const result = withTempPackageProject(process.cwd(), item.name, item);
console.log(result);

if (!item.expect.test(result)) {
  throw new Error(`keys-absent smoke failed: expected ${item.expect}, got ${result.slice(0, 300)}`);
}

console.log("OK: keys-absent smoke passed");
