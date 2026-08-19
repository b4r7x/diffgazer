import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { isEntryFresh, loadDiskCache, persistDiskCache } from "./disk-cache.js";

const EntrySchema = z.object({
  payload: z.array(z.string()),
  fetchedAt: z.string(),
});
type Entry = z.infer<typeof EntrySchema>;

let testDir: string;
const cachePath = (): string => path.join(testDir, "cache.json");
const writeRaw = (value: unknown): void => {
  fs.writeFileSync(cachePath(), `${JSON.stringify(value, null, 2)}\n`);
};

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dg-disk-cache-"));
});
afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe("loadDiskCache", () => {
  it("returns null when the file does not exist", () => {
    expect(loadDiskCache(cachePath(), EntrySchema)).toBeNull();
  });
  it("returns null when the stored value fails schema validation", () => {
    writeRaw({ payload: "not-an-array", fetchedAt: "x" });
    expect(loadDiskCache(cachePath(), EntrySchema)).toBeNull();
  });
  it("returns the parsed entry when valid", () => {
    const entry: Entry = { payload: ["a", "b"], fetchedAt: new Date().toISOString() };
    writeRaw(entry);
    expect(loadDiskCache(cachePath(), EntrySchema)).toEqual(entry);
  });
});

describe("persistDiskCache", () => {
  it("writes the entry so loadDiskCache reads it back", () => {
    const entry: Entry = { payload: ["x"], fetchedAt: new Date().toISOString() };
    persistDiskCache(cachePath(), entry);
    expect(loadDiskCache(cachePath(), EntrySchema)).toEqual(entry);
  });
});

describe("isEntryFresh", () => {
  const ttl = 24 * 60 * 60 * 1000;

  it("treats a recent entry within the TTL as fresh", () => {
    expect(isEntryFresh({ fetchedAt: new Date().toISOString() }, ttl)).toBe(true);
  });

  it("treats an entry older than the TTL as stale", () => {
    expect(isEntryFresh({ fetchedAt: new Date(Date.now() - ttl - 1000).toISOString() }, ttl)).toBe(
      false,
    );
  });

  it("treats a future-dated entry as not fresh so a refresh can re-run", () => {
    expect(isEntryFresh({ fetchedAt: new Date(Date.now() + ttl).toISOString() }, ttl)).toBe(false);
  });

  it("treats an unparseable timestamp as not fresh", () => {
    expect(isEntryFresh({ fetchedAt: "not-a-date" }, ttl)).toBe(false);
  });
});
