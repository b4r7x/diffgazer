import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach } from "vitest";
import { assertTempHome } from "./temp-home.js";

/**
 * Process-level backstop for the isolation invariant every store and persistence
 * fixture upholds by hand. `paths.ts` re-reads DIFFGAZER_HOME per call, so a suite
 * that never points it anywhere — or one that drops it before its work settles —
 * runs against the developer's real `~/.diffgazer`. A default scratch home closes
 * that window by omission, and the teardown check fails a suite that aims the
 * variable outside the OS temp directory.
 */
let scratchHome: string | null = null;

beforeEach(() => {
  if (process.env.DIFFGAZER_HOME) return;
  scratchHome ??= mkdtempSync(join(tmpdir(), "diffgazer-suite-"));
  process.env.DIFFGAZER_HOME = scratchHome;
});

afterEach(() => {
  const home = process.env.DIFFGAZER_HOME;
  if (home !== undefined && existsSync(home)) assertTempHome(home);
});

afterAll(() => {
  if (scratchHome !== null) rmSync(scratchHome, { recursive: true, force: true });
  scratchHome = null;
});
