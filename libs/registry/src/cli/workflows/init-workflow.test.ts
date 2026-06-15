import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Boundary observer: capture every path that init.ts's snapshot routine asks
// node:fs to read. We assert reads stay inside the declared plannedPaths scope
// (positive observable contract) instead of using chmod-0 as a loose negative
// sentinel that the macOS owner bit can bypass.
const fsObserver = vi.hoisted(() => ({
  reads: [] as string[],
  recording: false,
}));

// Boundary mock: node:fs wraps actual readFileSync to observe snapshot paths while delegating real fs behavior.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const observedReadFileSync = ((...args: Parameters<typeof actual.readFileSync>) => {
    if (fsObserver.recording) {
      fsObserver.reads.push(String(args[0]));
    }
    return actual.readFileSync(...args);
  }) as typeof actual.readFileSync;
  return { ...actual, readFileSync: observedReadFileSync };
});

import { runInitWorkflow } from "./init.js";

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

    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => ["created/", "created/new.txt", "existing/keep.txt"],
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
        afterFiles: async () => {
          throw new Error("install failed");
        },
        writeConfig: () => {},
        nextSteps: [],
      }),
    ).rejects.toThrow("install failed");

    expect(existsSync(join(tempDir, "created"))).toBe(false);
    expect(readFileSync(join(tempDir, "existing", "keep.txt"), "utf-8")).toBe("original\n");
  });

  it("restores overwritten files and config writes when writeConfig fails", async () => {
    writeFileSync(join(tempDir, "pre-existing.txt"), "original\n");

    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => ["pre-existing.txt", "created.txt"],
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
      }),
    ).rejects.toThrow("config failed");

    expect(readFileSync(join(tempDir, "pre-existing.txt"), "utf-8")).toBe("original\n");
    expect(existsSync(join(tempDir, "created.txt"))).toBe(false);
    expect(existsSync(join(tempDir, "tool.json"))).toBe(false);
  });

  it("preserves an existing config (including ownership manifest) when forced re-init fails mid-write", async () => {
    const originalConfig = {
      aliases: { components: "@/ui" },
      installedComponents: {
        "ui/button": { files: [{ path: "src/ui/button.tsx", hash: "sha256-abc" }] },
      },
    };
    writeFileSync(join(tempDir, "tool.json"), JSON.stringify(originalConfig, null, 2));

    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: true,
        loadConfig: () => ({ ok: true, config: originalConfig }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => [],
        createFiles: () => [],
        writeConfig: () => {
          writeFileSync(join(tempDir, "tool.json"), JSON.stringify({ aliases: {} }, null, 2));
          throw new Error("config write failed");
        },
        nextSteps: [],
      }),
    ).rejects.toThrow("config write failed");

    const restored = JSON.parse(readFileSync(join(tempDir, "tool.json"), "utf-8"));
    expect(restored).toEqual(originalConfig);
    expect(restored.installedComponents?.["ui/button"]).toBeDefined();
  });

  it("only snapshots files declared in plannedPaths (no recursive tree walk)", async () => {
    // Pre-create one declared planned-path file and an UNRELATED file outside
    // plannedPaths that would be picked up by any recursive whole-tree
    // snapshot. The boundary observer records every `readFileSync` issued by
    // init.ts; we assert the recorded set ⊆ the declared scope.
    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeFileSync(join(tempDir, "src", "styles.css"), "/* original */\n");
    mkdirSync(join(tempDir, "vendor", "deep", "nested"), { recursive: true });
    const unrelatedPath = join(tempDir, "vendor", "deep", "nested", "secret.txt");
    writeFileSync(unrelatedPath, "do not read me");

    const declaredFile = join(tempDir, "src", "styles.css");
    const configFile = join(tempDir, "tool.json");
    const allowedReads = new Set([declaredFile, configFile]);

    fsObserver.reads.length = 0;
    fsObserver.recording = true;
    try {
      await expect(
        runInitWorkflow({
          cwd: tempDir,
          configFileName: "tool.json",
          yes: true,
          force: false,
          loadConfig: () => ({ ok: false, error: "not_found" }),
          detectProject: () => ({ display: [] }),
          plannedPaths: () => ["src/styles.css"],
          createFiles: (cwd) => {
            writeFileSync(join(cwd, "src", "styles.css"), "/* css */\n");
            return [
              { action: "skipped", path: "src/" },
              { action: "skipped", path: "src/styles.css" },
            ];
          },
          writeConfig: (cwd) => writeFileSync(join(cwd, "tool.json"), "{}\n"),
          nextSteps: [],
        }),
      ).resolves.toBeUndefined();
    } finally {
      fsObserver.recording = false;
    }

    const recordedReads = new Set(fsObserver.reads);
    expect(recordedReads.has(declaredFile)).toBe(true);
    expect(recordedReads.has(unrelatedPath)).toBe(false);
    for (const read of recordedReads) {
      expect(allowedReads.has(read)).toBe(true);
    }

    expect(existsSync(configFile)).toBe(true);
  });

  it("rejects when plannedPaths is missing so a forgotten callsite cannot silently widen rollback gaps", async () => {
    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        // as any: negative-input test — verifies behavior with deliberately-malformed input
        plannedPaths: undefined as unknown as (cwd: string) => string[],
        createFiles: () => [],
        writeConfig: () => {},
        nextSteps: [],
      }),
    ).rejects.toThrow(/plannedPaths/);
  });

  it("removes a freshly-created planned-path file on rollback so installer side effects do not leak", async () => {
    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => ["lockfile.lock", "package.json"],
        createFiles: () => [],
        afterFiles: async (cwd) => {
          writeFileSync(join(cwd, "lockfile.lock"), "from-install\n");
          writeFileSync(
            join(cwd, "package.json"),
            JSON.stringify({ name: "x", dependencies: { dep: "1.0.0" } }),
          );
        },
        writeConfig: () => {
          throw new Error("config failed");
        },
        nextSteps: [],
      }),
    ).rejects.toThrow("config failed");

    expect(existsSync(join(tempDir, "lockfile.lock"))).toBe(false);
    expect(readFileSync(join(tempDir, "package.json"), "utf-8")).toBe("{}\n");
  });

  it("only restores files explicitly listed in plannedPaths on rollback", async () => {
    // A pre-existing file NOT declared in plannedPaths is left untouched by
    // both the snapshot AND the rollback. The targeted snapshot trades wide
    // restoration for predictable scoping: callers must declare every path
    // they may touch.
    writeFileSync(join(tempDir, "undeclared.txt"), "original\n");
    writeFileSync(join(tempDir, "declared.txt"), "original\n");

    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => ["declared.txt"],
        createFiles: () => {
          writeFileSync(join(tempDir, "declared.txt"), "modified\n");
          writeFileSync(join(tempDir, "undeclared.txt"), "modified\n");
          return [
            { action: "skipped", path: "declared.txt" },
            { action: "skipped", path: "undeclared.txt" },
          ];
        },
        writeConfig: () => {
          throw new Error("boom");
        },
        nextSteps: [],
      }),
    ).rejects.toThrow("boom");

    expect(readFileSync(join(tempDir, "declared.txt"), "utf-8")).toBe("original\n");
    expect(readFileSync(join(tempDir, "undeclared.txt"), "utf-8")).toBe("modified\n");
  });
});
