#!/usr/bin/env node

/**
 * Agent review loop: run `pnpm run parity:capture`, view the PNGs, read the TXT
 * frames, and judge the subjective layout. The fixture facts tests remain the
 * objective gate. For a real-binary frame, use tmux and `capture-pane -p`.
 *
 * Supported mobile verification: emulated viewports against the loopback server.
 * LAN exposure (`--host`), authentication, and compression are deliberately out
 * of scope pending a dedicated security review.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const outputDir = resolve(root, "artifacts/parity");
function run(command, args, label, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${String(result.status)}`);
  }
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
run(
  "pnpm",
  ["--filter", "@diffgazer/web", "exec", "playwright", "test", "--grep", "@parity"],
  "Web parity screenshots",
  { ...process.env, DIFFGAZER_PARITY_CAPTURE_DIR: outputDir },
);
run(
  "pnpm",
  [
    "--filter",
    "diffgazer",
    "exec",
    "tsx",
    "--tsconfig",
    "tsconfig.json",
    "src/testing/capture-review-frames.tsx",
    outputDir,
  ],
  "TUI parity frames",
);
console.log(`Parity captures written to ${outputDir}`);
