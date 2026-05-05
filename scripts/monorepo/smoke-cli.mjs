#!/usr/bin/env node

import { execSync } from "node:child_process";

const root = process.cwd();

const commands = [
  {
    name: "diffgazer --help",
    command: "node cli/diffgazer/dist/index.js --help",
    expect: /help|Usage|review|app/i,
    label: "product CLI help",
  },
  {
    name: "dgadd --help",
    command: "node cli/add/dist/index.js --help",
    expect: /help|Usage|add/i,
    label: "installer CLI help",
  },
  {
    name: "dgadd ui item",
    command: "node cli/add/dist/index.js add --help",
    expect: /ui\/\*|ui/i,
    label: "installer ui namespace",
  },
  {
    name: "dgadd keys item",
    command: "node cli/add/dist/index.js add --help",
    expect: /keys\/\*|keys/i,
    label: "installer keys namespace",
  },
];

for (const check of commands) {
  const output = execSync(check.command, {
    encoding: "utf8",
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  }).toString();

  if (!check.expect.test(output)) {
    throw new Error(`Smoke check failed for ${check.label}: expected ${check.expect}, got ${output.slice(0, 250)}`);
  }

  console.log(`OK: ${check.name}`);
}

console.log("OK: CLI smoke checks passed");
