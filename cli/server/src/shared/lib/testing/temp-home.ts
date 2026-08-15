import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

const TEMP_ROOT = realpathSync.native(tmpdir());

/**
 * Fixture guard for every suite that points DIFFGAZER_HOME at a scratch directory.
 * `paths.ts` re-reads the variable on each call, so a fixture that resolves outside
 * the OS temp directory would run the suite against the developer's real
 * `~/.diffgazer`. Fail loudly at setup instead, before any store or persistence work.
 */
export function assertTempHome(home: string): void {
  const resolved = realpathSync.native(home);
  if (resolved !== TEMP_ROOT && !resolved.startsWith(TEMP_ROOT + sep)) {
    throw new Error(`Test DIFFGAZER_HOME must resolve under ${TEMP_ROOT}, got ${resolved}`);
  }
}

export interface TempHome {
  readonly path: string;
  release(): Promise<void>;
}

/**
 * Points DIFFGAZER_HOME at a fresh scratch directory and hands back its teardown.
 *
 * Call it from `vi.hoisted` in a suite that imports the server graph at module scope:
 * `storage/project-index.ts` freezes its reviews directory from DIFFGAZER_HOME the first
 * time it is imported, so a `beforeAll` runs too late and the suite binds to the real home.
 */
export function claimTempHome(prefix: string): TempHome {
  const previous = process.env.DIFFGAZER_HOME;
  const path = mkdtempSync(join(tmpdir(), prefix));
  assertTempHome(path);
  process.env.DIFFGAZER_HOME = path;
  return { path, release: () => releaseTempHome(path, previous) };
}

// Settle the config store, remove the scratch directory, and only then restore
// DIFFGAZER_HOME: `paths.ts` re-reads the variable per call, so restoring it while a
// document-lock acquisition is still pending re-points that work at the real ~/.diffgazer.
async function releaseTempHome(path: string, previous: string | undefined): Promise<void> {
  try {
    const { getStore } = await import("../config/store.js");
    await getStore().ready();
    rmSync(path, { recursive: true, force: true });
  } finally {
    if (previous === undefined) delete process.env.DIFFGAZER_HOME;
    else process.env.DIFFGAZER_HOME = previous;
  }
}
