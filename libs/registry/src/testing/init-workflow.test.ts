import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInitWorkflow } from "../cli/workflows/init.js";

describe("runInitWorkflow rollback", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-init-"));
    writeFileSync(join(tempDir, "package.json"), "{}\n");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("removes created files and keeps skipped pre-existing files when afterFiles fails", async () => {
    mkdirSync(join(tempDir, "existing"), { recursive: true });
    writeFileSync(join(tempDir, "existing", "keep.txt"), "original\n");

    await expect(runInitWorkflow({
      cwd: tempDir,
      configFileName: "tool.json",
      yes: true,
      force: false,
      loadConfig: () => ({ ok: false, error: "not_found" }),
      detectProject: () => ({ display: [] }),
      createFiles: () => {
        mkdirSync(join(tempDir, "created"), { recursive: true });
        writeFileSync(join(tempDir, "created", "new.txt"), "new\n");
        writeFileSync(join(tempDir, "existing", "keep.txt"), "changed\n");
        return [
          { action: "created", path: "created/" },
          { action: "created", path: "created/new.txt" },
          { action: "skipped", path: "existing/keep.txt" },
        ];
      },
      afterFiles: async () => { throw new Error("install failed"); },
      writeConfig: () => {},
      nextSteps: [],
    })).rejects.toThrow("install failed");

    expect(existsSync(join(tempDir, "created"))).toBe(false);
    expect(readFileSync(join(tempDir, "existing", "keep.txt"), "utf-8")).toBe("original\n");
  });

  it("restores overwritten files and config writes when writeConfig fails", async () => {
    writeFileSync(join(tempDir, "pre-existing.txt"), "original\n");

    await expect(runInitWorkflow({
      cwd: tempDir,
      configFileName: "tool.json",
      yes: true,
      force: false,
      loadConfig: () => ({ ok: false, error: "not_found" }),
      detectProject: () => ({ display: [] }),
      createFiles: () => {
        writeFileSync(join(tempDir, "pre-existing.txt"), "changed\n");
        writeFileSync(join(tempDir, "created.txt"), "new\n");
        return [
          { action: "skipped", path: "pre-existing.txt" },
          { action: "created", path: "created.txt" },
        ];
      },
      writeConfig: () => {
        writeFileSync(join(tempDir, "tool.json"), "{}\n");
        throw new Error("config failed");
      },
      nextSteps: [],
    })).rejects.toThrow("config failed");

    expect(readFileSync(join(tempDir, "pre-existing.txt"), "utf-8")).toBe("original\n");
    expect(existsSync(join(tempDir, "created.txt"))).toBe(false);
    expect(existsSync(join(tempDir, "tool.json"))).toBe(false);
  });
});
