import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, vi } from "vitest";

export let tempHome: string;

beforeEach(async () => {
  tempHome = await mkdtemp(path.join(tmpdir(), "diffgazer-state-"));
  process.env.DIFFGAZER_HOME = tempHome;
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  await rm(tempHome, { recursive: true, force: true });
});

export async function writeJson(fileName: string, data: unknown): Promise<void> {
  await writeFile(path.join(tempHome, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

export const homePath = (...segments: string[]): string => path.join(tempHome, ...segments);
