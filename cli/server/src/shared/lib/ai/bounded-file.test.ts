import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readTextFileWithLimit } from "./bounded-file.js";

describe("readTextFileWithLimit", () => {
  it("rejects files larger than the admitted byte cap before reading", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "bounded-file-"));
    const filePath = path.join(dir, "oversize.json");
    await writeFile(filePath, "x".repeat(64));

    const result = await readTextFileWithLimit(filePath, 32);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("oversize-response");
  });

  it("reads files within the admitted byte cap", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "bounded-file-"));
    const filePath = path.join(dir, "result.json");
    await writeFile(filePath, JSON.stringify({ issues: [] }), "utf8");

    const result = await readTextFileWithLimit(filePath, 1_024);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.value)).toEqual({ issues: [] });
  });
});
