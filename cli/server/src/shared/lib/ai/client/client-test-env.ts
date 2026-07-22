import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

let diffgazerHome: string;

export function setupClientTestHome(): void {
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-ai-client-"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  vi.resetModules();
  vi.clearAllMocks();
}

export function teardownClientTestHome(): void {
  vi.restoreAllMocks();
  delete process.env.DIFFGAZER_HOME;
  rmSync(diffgazerHome, { recursive: true, force: true });
}

export async function loadCreate() {
  return import("./create.js");
}
