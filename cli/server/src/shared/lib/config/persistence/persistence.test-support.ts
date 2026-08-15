import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, vi } from "vitest";
import { assertTempHome } from "../../testing/temp-home.js";

export let tempHome: string;

beforeEach(async () => {
  tempHome = await mkdtemp(path.join(tmpdir(), "diffgazer-state-"));
  assertTempHome(tempHome);
  process.env.DIFFGAZER_HOME = tempHome;
  vi.resetModules();
});

// Remove the temp home before dropping DIFFGAZER_HOME: `paths.ts` re-reads the variable
// per call, so restoring it first would re-point any still-pending work at the real
// ~/.diffgazer. These suites call persistence directly and await every home-scoped call;
// the one background writer they start (the project-move reconcile flight) targets a
// project path captured at call time, never a path re-derived from the environment.
afterEach(async () => {
  await rm(tempHome, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
});

export async function writeJson(fileName: string, data: unknown): Promise<void> {
  await writeFile(path.join(tempHome, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

export const homePath = (...segments: string[]): string => path.join(tempHome, ...segments);
