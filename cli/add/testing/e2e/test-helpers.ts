import { execFileSync, type SpawnSyncReturns, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dgaddChildEnv } from "../../src/commands/testing/child-env.js";
import { writeProjectFixture } from "../../src/commands/testing/project-fixture.js";
import {
  type DiffgazerAddConfig,
  DiffgazerAddConfigSchema,
  type ManifestItem,
} from "../../src/context.js";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

// Node's synchronous child APIs block this worker's event loop, so vitest's own
// testTimeout timer cannot fire while a child is wedged. Each child therefore
// carries its own deadline, kept under the enclosing test deadline so a hang
// fails the test and afterEach still gets to remove the fixture.
const DEFAULT_CHILD_TIMEOUT_MS = 25_000;

export interface DgaddRunOptions {
  silent?: boolean;
  /** Overrides layered on top of the inherited, colour-free child environment. */
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

// Built once per vitest run by ../global-setup.ts.
const dgaddEntry = resolve(repoRoot, "cli/add/dist/index.js");

function dgaddArgv(args: string[], silent: boolean): string[] {
  return [dgaddEntry, ...(silent ? ["--silent"] : []), ...args];
}

function dgaddSpawnOptions(opts: DgaddRunOptions | undefined) {
  return {
    cwd: repoRoot,
    encoding: "utf-8",
    env: dgaddChildEnv(opts?.env),
    timeout: opts?.timeoutMs ?? DEFAULT_CHILD_TIMEOUT_MS,
    killSignal: "SIGKILL",
  } as const;
}

/** Runs dgadd and returns stdout; a non-zero exit throws with the child's stderr. */
export function runDgadd(args: string[], opts?: DgaddRunOptions): string {
  return execFileSync(
    process.execPath,
    dgaddArgv(args, opts?.silent ?? true),
    dgaddSpawnOptions(opts),
  );
}

/** Runs dgadd and returns the raw result, for tests that assert on a failing exit. */
export function spawnDgadd(args: string[], opts?: DgaddRunOptions): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    dgaddArgv(args, opts?.silent ?? false),
    dgaddSpawnOptions(opts),
  );
}

export function readFixtureConfig(root: string): DiffgazerAddConfig {
  return DiffgazerAddConfigSchema.parse(
    JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")),
  );
}

export function manifestItem(config: DiffgazerAddConfig, name: string): ManifestItem {
  const item = config.installedItems?.[name];
  if (!item) throw new Error(`Expected installed manifest item "${name}"`);
  return item;
}

export function writeFixtureConfig(root: string): void {
  writeProjectFixture(root, {
    packageJson: { type: "module", devDependencies: { tailwindcss: "^4.0.0" } },
  });
}
