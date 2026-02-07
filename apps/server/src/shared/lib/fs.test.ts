import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
  promises: {
    writeFile: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
  },
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid",
}));

import { readJsonFileSync, writeJsonFileSync, removeFileSync, atomicWriteFile } from "./fs.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readJsonFileSync", () => {
  it("should read and parse JSON file", () => {
    const data = { key: "value" };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(data));

    const result = readJsonFileSync<{ key: string }>("/test/file.json");

    expect(result).toEqual(data);
    expect(fs.readFileSync).toHaveBeenCalledWith("/test/file.json", "utf-8");
  });

  it("should return null for ENOENT", () => {
    const error = new Error("not found") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw error; });

    expect(readJsonFileSync("/missing.json")).toBeNull();
  });

  it("should return null for corrupt JSON and log warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(fs.readFileSync).mockReturnValue("not json {{{");

    expect(readJsonFileSync("/corrupt.json")).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warningMessage = warnSpy.mock.calls[0]?.[0];
    expect(warningMessage).toContain("/corrupt.json");
    warnSpy.mockRestore();
  });
});

describe("writeJsonFileSync", () => {
  it("should write to temp file then rename (atomic)", () => {
    const data = { foo: "bar" };

    writeJsonFileSync("/test/file.json", data);

    expect(fs.mkdirSync).toHaveBeenCalledWith("/test", { recursive: true, mode: 0o700 });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/test/file.json.test-uuid.tmp",
      JSON.stringify(data, null, 2) + "\n",
      { mode: 0o600 },
    );
    expect(fs.renameSync).toHaveBeenCalledWith(
      "/test/file.json.test-uuid.tmp",
      "/test/file.json",
    );
  });

  it("should use custom file mode", () => {
    writeJsonFileSync("/test/file.json", {}, 0o644);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { mode: 0o644 },
    );
  });
});

describe("removeFileSync", () => {
  it("should remove file and return true", () => {
    vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

    expect(removeFileSync("/test/file.json")).toBe(true);
    expect(fs.unlinkSync).toHaveBeenCalledWith("/test/file.json");
  });

  it("should return false for ENOENT (no error)", () => {
    const error = new Error("not found") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    vi.mocked(fs.unlinkSync).mockImplementation(() => { throw error; });

    expect(removeFileSync("/missing.json")).toBe(false);
  });

  it("should rethrow non-ENOENT errors", () => {
    const error = new Error("permission denied") as NodeJS.ErrnoException;
    error.code = "EACCES";
    vi.mocked(fs.unlinkSync).mockImplementation(() => { throw error; });

    expect(() => removeFileSync("/denied.json")).toThrow("permission denied");
  });
});

describe("atomicWriteFile", () => {
  it("should write to temp file then rename using randomUUID", async () => {
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.promises.rename).mockResolvedValue(undefined);

    await atomicWriteFile("/test/file.txt", "content");

    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/^\/test\/file\.txt\.[a-z0-9-]+\.tmp$/i),
      "content",
      { mode: 0o600 },
    );

    const tempPath = vi.mocked(fs.promises.writeFile).mock.calls[0]?.[0];
    expect(fs.promises.rename).toHaveBeenCalledWith(tempPath, "/test/file.txt");
  });

  it("should clean up temp file on write error", async () => {
    vi.mocked(fs.promises.writeFile).mockRejectedValue(new Error("write failed"));
    vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);

    await expect(atomicWriteFile("/test/file.txt", "content")).rejects.toThrow("write failed");
    expect(fs.promises.unlink).toHaveBeenCalled();
  });

  it("should clean up temp file on rename error", async () => {
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.promises.rename).mockRejectedValue(new Error("rename failed"));
    vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);

    await expect(atomicWriteFile("/test/file.txt", "content")).rejects.toThrow("rename failed");
    expect(fs.promises.unlink).toHaveBeenCalled();
  });
});
