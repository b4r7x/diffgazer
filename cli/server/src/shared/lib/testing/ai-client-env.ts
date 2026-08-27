import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";
import { assertTempHome } from "./temp-home.js";

let diffgazerHome: string;

export function setupClientTestHome(): void {
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-ai-client-"));
  assertTempHome(diffgazerHome);
  process.env.DIFFGAZER_HOME = diffgazerHome;
  vi.resetModules();
  vi.clearAllMocks();
}

/** The temp home the current test is running against, for path-leak assertions. */
export function clientTestHome(): string {
  return diffgazerHome;
}

// Remove the temp home before dropping DIFFGAZER_HOME: `paths.ts` re-reads the variable
// per call, so restoring it first would re-point still-pending work at the real
// ~/.diffgazer. The AI client never reaches the config store (`create.ts` does not import
// `initialize.ts`) and awaits its own home-scoped reads, so nothing is left to drain.
export function teardownClientTestHome(): void {
  vi.restoreAllMocks();
  rmSync(diffgazerHome, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
}

export async function loadCreate() {
  return import("../ai/client/create.js");
}
