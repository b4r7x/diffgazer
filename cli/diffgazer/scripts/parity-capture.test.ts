import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

test("attempts the TUI capture and reports every failed stage after a web failure", () => {
  const root = mkdtempSync(join(tmpdir(), "diffgazer-parity-capture-"));
  tempRoots.push(root);

  const scriptPath = join(root, "cli/diffgazer/scripts/parity-capture.mjs");
  mkdirSync(dirname(scriptPath), { recursive: true });
  copyFileSync(resolve(import.meta.dirname, "parity-capture.mjs"), scriptPath);

  const callsPath = join(root, "calls.txt");
  const binDir = join(root, "bin");
  const pnpmPath = join(binDir, "pnpm");
  mkdirSync(binDir);
  writeFileSync(
    pnpmPath,
    `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
appendFileSync(process.env.PARITY_CALLS_PATH, process.argv.slice(2).join(" ") + "\\n");
process.exit(process.argv.includes("@diffgazer/web") ? 7 : 9);
`,
  );
  chmodSync(pnpmPath, 0o755);

  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      PARITY_CALLS_PATH: callsPath,
      PATH: `${binDir}${delimiter}${process.env.PATH}`,
    },
  });

  expect(result.status).toBe(1);
  expect(readFileSync(callsPath, "utf8").split("\n")).toEqual([
    "--filter @diffgazer/web exec playwright test --grep @parity",
    "--filter diffgazer exec tsx --tsconfig tsconfig.json src/testing/capture-review-frames.tsx " +
      join(realpathSync(root), "artifacts/parity"),
    "",
  ]);
  expect(result.stderr).toContain("Web parity screenshots failed with exit code 7");
  expect(result.stderr).toContain("TUI parity frames failed with exit code 9");
});

test("reports a spawn error for each stage when pnpm cannot be started", () => {
  const root = mkdtempSync(join(tmpdir(), "diffgazer-parity-capture-"));
  tempRoots.push(root);

  const scriptPath = join(root, "cli/diffgazer/scripts/parity-capture.mjs");
  mkdirSync(dirname(scriptPath), { recursive: true });
  copyFileSync(resolve(import.meta.dirname, "parity-capture.mjs"), scriptPath);
  const emptyPath = join(root, "empty-bin");
  mkdirSync(emptyPath);

  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: { ...process.env, PATH: emptyPath },
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Web parity screenshots failed to start: spawnSync pnpm ENOENT");
  expect(result.stderr).toContain("TUI parity frames failed to start: spawnSync pnpm ENOENT");
  expect(result.stderr).not.toContain("exit code null");
});

test("reports the terminating signal when a parity stage is killed", () => {
  const root = mkdtempSync(join(tmpdir(), "diffgazer-parity-capture-"));
  tempRoots.push(root);

  const scriptPath = join(root, "cli/diffgazer/scripts/parity-capture.mjs");
  mkdirSync(dirname(scriptPath), { recursive: true });
  copyFileSync(resolve(import.meta.dirname, "parity-capture.mjs"), scriptPath);

  const binDir = join(root, "bin");
  const pnpmPath = join(binDir, "pnpm");
  mkdirSync(binDir);
  writeFileSync(
    pnpmPath,
    `#!/usr/bin/env node
if (process.argv.includes("@diffgazer/web")) process.kill(process.pid, "SIGTERM");
`,
  );
  chmodSync(pnpmPath, 0o755);

  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH}` },
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Web parity screenshots terminated by signal SIGTERM");
  expect(result.stderr).not.toContain("exit code null");
});
