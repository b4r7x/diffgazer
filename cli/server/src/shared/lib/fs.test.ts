import * as fs from "node:fs";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  atomicWriteFile,
  readJsonFileSync,
  removeFileSync,
  writeJsonFile,
  writeJsonFileSync,
} from "./fs.js";
import { log } from "./log.js";

// Boundary mock: logging writes process-visible diagnostics; tests assert the warning without emitting it.
vi.mock("./log.js", () => ({ log: vi.fn() }));

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "diffgazer-fs-"));
  vi.mocked(log).mockClear();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(tempRoot, { recursive: true, force: true });
});

describe("JSON file helpers", () => {
  it("writes and reads formatted JSON through the real filesystem", async () => {
    const filePath = join(tempRoot, "nested", "file.json");
    const data = { key: "value" };

    writeJsonFileSync(filePath, data);

    expect(readJsonFileSync(filePath)).toEqual(data);
    await expect(readFile(filePath, "utf-8")).resolves.toBe(`${JSON.stringify(data, null, 2)}\n`);
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    await expect(readdir(join(tempRoot, "nested"))).resolves.toEqual(["file.json"]);
  });

  it("returns null for missing or corrupt JSON files", async () => {
    const corruptPath = join(tempRoot, "corrupt.json");
    await writeFile(corruptPath, "not json {{{", "utf-8");

    expect(readJsonFileSync(join(tempRoot, "missing.json"))).toBeNull();
    expect(readJsonFileSync(corruptPath)).toBeNull();
    expect(log).toHaveBeenCalledWith(
      "warn",
      "fs_json_parse_failed",
      expect.objectContaining({ filePath: corruptPath }),
    );
  });

  it("removes files and reports when they were already absent", async () => {
    const filePath = join(tempRoot, "delete-me.json");
    await writeFile(filePath, "{}", "utf-8");

    expect(removeFileSync(filePath)).toBe(true);
    expect(removeFileSync(filePath)).toBe(false);
  });

  it("cleans up the temp file when writeJsonFileSync rename fails", async () => {
    // Force renameSync to throw by making the destination a non-empty directory.
    const filePath = join(tempRoot, "secrets.json");
    fs.mkdirSync(filePath);
    await writeFile(join(filePath, "child"), "x", "utf-8");

    expect(() => writeJsonFileSync(filePath, { key: "value" })).toThrow();

    const leftovers = (await readdir(tempRoot)).filter((name) => name.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });
});

describe("writeJsonFile", () => {
  it("writes formatted JSON atomically without leaving temp files", async () => {
    const filePath = join(tempRoot, "nested", "file.json");
    const data = { key: "value" };

    await writeJsonFile(filePath, data);

    await expect(readFile(filePath, "utf-8")).resolves.toBe(`${JSON.stringify(data, null, 2)}\n`);
    await expect(readdir(join(tempRoot, "nested"))).resolves.toEqual(["file.json"]);
  });

  it("cleans up the temp file when rename fails", async () => {
    const filePath = join(tempRoot, "file.json");
    vi.spyOn(fs.promises, "rename").mockRejectedValueOnce(new Error("rename failed"));

    await expect(writeJsonFile(filePath, { key: "value" })).rejects.toThrow("rename failed");

    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });
});

describe("atomicWriteFile", () => {
  it("persists content atomically without leaving temp files", async () => {
    const filePath = join(tempRoot, "file.txt");

    await atomicWriteFile(filePath, "content");

    await expect(readFile(filePath, "utf-8")).resolves.toBe("content");
    await expect(readdir(tempRoot)).resolves.toEqual(["file.txt"]);
  });

  it("cleans up the temp file when rename fails", async () => {
    const filePath = join(tempRoot, "file.txt");
    vi.spyOn(fs.promises, "rename").mockRejectedValueOnce(new Error("rename failed"));

    await expect(atomicWriteFile(filePath, "content")).rejects.toThrow("rename failed");

    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });
});
