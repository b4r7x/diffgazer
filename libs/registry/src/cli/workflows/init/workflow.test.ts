import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Boundary observer: capture every path that rollback.ts's snapshot routine asks
// node:fs to read. We assert reads stay inside the declared plannedPaths scope
// (positive observable contract) instead of using chmod-0 as a loose negative
// sentinel that the macOS owner bit can bypass.
const fsObserver = vi.hoisted(() => ({
  reads: [] as string[],
  recording: false,
  rmFailurePath: null as string | null,
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
  const observedRmSync = ((...args: Parameters<typeof actual.rmSync>) => {
    if (String(args[0]) === fsObserver.rmFailurePath) {
      fsObserver.rmFailurePath = null;
      throw new Error("cleanup failed");
    }
    return actual.rmSync(...args);
  }) as typeof actual.rmSync;
  return { ...actual, readFileSync: observedReadFileSync, rmSync: observedRmSync };
});

import { runInitWorkflow } from "./workflow.js";

describe("runInitWorkflow rollback", () => {
  let tempDir: string;

  beforeEach(() => {
    fsObserver.rmFailurePath = null;
    tempDir = mkdtempSync(join(tmpdir(), "rk-init-"));
    writeFileSync(join(tempDir, "package.json"), "{}\n");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("removes empty planned parent directories when afterFiles fails", async () => {
    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => [
          "src/",
          "src/lib/",
          "src/lib/utils.ts",
          "src/styles/",
          "src/styles/theme.css",
        ],
        createFiles: (cwd) => {
          mkdirSync(join(cwd, "src/lib"), { recursive: true });
          mkdirSync(join(cwd, "src/styles"), { recursive: true });
          writeFileSync(join(cwd, "src/lib/utils.ts"), "export {}\n");
          writeFileSync(join(cwd, "src/styles/theme.css"), "/* theme */\n");
          return [
            { action: "created", path: "src/lib/utils.ts" },
            { action: "created", path: "src/styles/theme.css" },
          ];
        },
        afterFiles: async () => {
          throw new Error("install failed");
        },
        writeConfig: () => {},
        nextSteps: [],
      }),
    ).rejects.toThrow("install failed");

    expect(existsSync(join(tempDir, "src"))).toBe(false);
  });

  it("removes directories createFiles made before it threw, without a result array", async () => {
    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => ["src/components/ui/", "src/hooks/", "src/lib/utils.ts"],
        createFiles: (cwd) => {
          mkdirSync(join(cwd, "src/components/ui"), { recursive: true });
          mkdirSync(join(cwd, "src/hooks"), { recursive: true });
          throw new Error("seed write failed");
        },
        writeConfig: () => {},
        nextSteps: [],
      }),
    ).rejects.toThrow("seed write failed");

    expect(existsSync(join(tempDir, "src"))).toBe(false);
    expect(existsSync(join(tempDir, "tool.json"))).toBe(false);
  });

  it("keeps a pre-existing planned directory when createFiles throws", async () => {
    mkdirSync(join(tempDir, "src/hooks"), { recursive: true });
    writeFileSync(join(tempDir, "src/hooks/keep.ts"), "export {}\n");

    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => ["src/components/ui/", "src/hooks/"],
        createFiles: (cwd) => {
          mkdirSync(join(cwd, "src/components/ui"), { recursive: true });
          throw new Error("seed write failed");
        },
        writeConfig: () => {},
        nextSteps: [],
      }),
    ).rejects.toThrow("seed write failed");

    expect(existsSync(join(tempDir, "src/components"))).toBe(false);
    expect(readFileSync(join(tempDir, "src/hooks/keep.ts"), "utf-8")).toBe("export {}\n");
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

  it("runs every compensation and preserves the primary error when the first removal fails", async () => {
    const packagePath = join(tempDir, "package.json");
    const lockfilePath = join(tempDir, "pnpm-lock.yaml");
    const configPath = join(tempDir, "tool.json");
    const outputPath = join(tempDir, "generated", "output.ts");
    writeFileSync(packagePath, '{"name":"before"}\n');
    writeFileSync(lockfilePath, "before-lock\n");
    writeFileSync(configPath, '{"enabled":true}\n');
    const primaryError = new Error("config failed");
    fsObserver.rmFailurePath = outputPath;

    let caught: unknown;
    try {
      await runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: true,
        loadConfig: () => ({ ok: true, config: { enabled: true } }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => ["generated/", "package.json", "pnpm-lock.yaml"],
        createFiles: (cwd) => {
          mkdirSync(join(cwd, "generated"), { recursive: true });
          writeFileSync(outputPath, "created\n");
          return [{ action: "created", path: "generated/output.ts" }];
        },
        afterFiles: async (cwd) => {
          writeFileSync(join(cwd, "package.json"), '{"name":"after"}\n');
          writeFileSync(join(cwd, "pnpm-lock.yaml"), "after-lock\n");
        },
        writeConfig: (cwd) => {
          writeFileSync(join(cwd, "tool.json"), '{"enabled":false}\n');
          throw primaryError;
        },
        nextSteps: [],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(primaryError);
    expect(primaryError.cause).toBeInstanceOf(AggregateError);
    expect((primaryError.cause as AggregateError).errors).toEqual([
      expect.objectContaining({ message: `Failed to remove ${outputPath}` }),
      expect.objectContaining({
        message: `Failed to remove directory ${join(tempDir, "generated")}`,
      }),
    ]);
    expect(readFileSync(packagePath, "utf-8")).toBe('{"name":"before"}\n');
    expect(readFileSync(lockfilePath, "utf-8")).toBe("before-lock\n");
    expect(readFileSync(configPath, "utf-8")).toBe('{"enabled":true}\n');
    expect(readFileSync(outputPath, "utf-8")).toBe("created\n");
  });

  it("keeps the primary error's own cause when the rollback report is attached", async () => {
    const outputPath = join(tempDir, "generated", "output.ts");
    const rootCause = new Error("ENOSPC: no space left on device");
    const primaryError = new Error("Failed to write config", { cause: rootCause });
    fsObserver.rmFailurePath = outputPath;

    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => ["generated/"],
        createFiles: (cwd) => {
          mkdirSync(join(cwd, "generated"), { recursive: true });
          writeFileSync(outputPath, "created\n");
          return [{ action: "created", path: "generated/output.ts" }];
        },
        writeConfig: () => {
          throw primaryError;
        },
        nextSteps: [],
      }),
    ).rejects.toBe(primaryError);

    expect((primaryError.cause as AggregateError).errors[0]).toBe(rootCause);
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

  it("skips re-init and points to --force without touching files when a valid config already exists and force is false", async () => {
    const originalConfig = { aliases: { components: "@/ui" } };
    writeFileSync(join(tempDir, "tool.json"), JSON.stringify(originalConfig, null, 2));
    const originalBytes = readFileSync(join(tempDir, "tool.json"), "utf-8");

    const createFiles = vi.fn(() => []);
    const afterFiles = vi.fn(async () => {});
    const writeConfig = vi.fn(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    let output: string;

    try {
      await runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({ ok: true, config: originalConfig }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => [],
        createFiles,
        afterFiles,
        writeConfig,
        nextSteps: [],
      });
      output = [...warnSpy.mock.calls, ...logSpy.mock.calls].flat().join("\n");
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }

    expect(readFileSync(join(tempDir, "tool.json"), "utf-8")).toBe(originalBytes);
    expect(output).toContain("--force");
    expect(createFiles).not.toHaveBeenCalled();
    expect(afterFiles).not.toHaveBeenCalled();
    expect(writeConfig).not.toHaveBeenCalled();
  });

  it("rejects malformed configs without advertising --force as a ledger-safe recovery path", async () => {
    writeFileSync(join(tempDir, "tool.json"), "{ not valid json\n");

    const parseError = await runInitWorkflow({
      cwd: tempDir,
      configFileName: "tool.json",
      yes: true,
      force: false,
      loadConfig: () => ({
        ok: false,
        error: "parse_error",
        message: "Unexpected token n",
      }),
      detectProject: () => ({ display: [] }),
      plannedPaths: () => [],
      createFiles: () => [],
      writeConfig: () => {},
      nextSteps: [],
    }).catch((error: unknown) => error);
    expect(String(parseError)).toMatch(/before re-initializing/);
    expect(String(parseError)).not.toMatch(/--force to re-initialize/);

    await expect(
      runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        loadConfig: () => ({
          ok: false,
          error: "validation_error",
          message: "Invalid tool.json",
        }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => [],
        createFiles: () => [],
        writeConfig: () => {},
        nextSteps: [],
      }),
    ).rejects.toThrow(/before re-initializing/);
  });

  it("rolls back created files and exits when installation is cancelled via SIGINT", async () => {
    const targetPath = join(tempDir, "created.txt");
    let releaseInstall: (() => void) | undefined;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as typeof process.exit);

    const plan = runInitWorkflow({
      cwd: tempDir,
      configFileName: "tool.json",
      yes: true,
      force: false,
      loadConfig: () => ({ ok: false, error: "not_found" }),
      detectProject: () => ({ display: [] }),
      plannedPaths: () => ["created.txt"],
      createFiles: () => {
        writeFileSync(targetPath, "new\n");
        return [{ action: "created", path: "created.txt" }];
      },
      afterFiles: async (_cwd, abortSignal) => {
        await new Promise<void>((resolve, reject) => {
          abortSignal?.addEventListener(
            "abort",
            () => {
              reject(abortSignal.reason ?? new Error("aborted"));
            },
            { once: true },
          );
          releaseInstall = resolve;
        });
      },
      writeConfig: () => {},
      nextSteps: [],
    });

    await vi.waitFor(() => expect(releaseInstall).toBeDefined());
    process.emit("SIGINT");
    releaseInstall?.();

    await expect(plan).rejects.toThrow("process.exit:130");
    expect(existsSync(targetPath)).toBe(false);
    exitSpy.mockRestore();
  });

  it("dry-run previews every planned target, its create/modify marker, and the dependencies", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    mkdirSync(join(tempDir, "src", "components"), { recursive: true });

    try {
      await runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        dryRun: true,
        dependencies: ["left-pad@1.0.0"],
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => ["src/components/", "src/lib/utils.ts", "package.json"],
        createFiles: () => {
          throw new Error("createFiles should not run during dry-run");
        },
        writeConfig: () => {
          throw new Error("writeConfig should not run during dry-run");
        },
        nextSteps: [],
      });

      const lines = log.mock.calls.map((call) => String(call[0] ?? ""));
      const lineFor = (path: string) => lines.find((line) => line.includes(path)) ?? "";
      expect(lineFor("src/components/")).toContain("~");
      expect(lineFor("src/lib/utils.ts")).toContain("+");
      expect(lineFor("package.json")).toContain("~");
      expect(lineFor("tool.json")).toContain("+");
      expect(lines.join("\n")).toContain("left-pad@1.0.0");
    } finally {
      log.mockRestore();
    }

    expect(existsSync(join(tempDir, "tool.json"))).toBe(false);
    expect(existsSync(join(tempDir, "src", "lib"))).toBe(false);
  });

  it("dry-run omits dependencies when installation is skipped", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await runInitWorkflow({
        cwd: tempDir,
        configFileName: "tool.json",
        yes: true,
        force: false,
        dryRun: true,
        skipInstall: true,
        dependencies: ["left-pad@1.0.0"],
        loadConfig: () => ({ ok: false, error: "not_found" }),
        detectProject: () => ({ display: [] }),
        plannedPaths: () => ["package.json"],
        createFiles: () => [],
        writeConfig: () => {},
        nextSteps: [],
      });

      const output = log.mock.calls.map((call) => String(call[0] ?? "")).join("\n");
      expect(output).not.toContain("left-pad@1.0.0");
    } finally {
      log.mockRestore();
    }
  });

  it("dry-run returns before confirmation in a non-interactive process", async () => {
    const stdin = process.stdin.isTTY;
    const stdout = process.stdout.isTTY;
    process.stdin.isTTY = false;
    process.stdout.isTTY = false;

    try {
      await expect(
        runInitWorkflow({
          cwd: tempDir,
          configFileName: "tool.json",
          yes: false,
          force: false,
          dryRun: true,
          loadConfig: () => ({ ok: false, error: "not_found" }),
          detectProject: () => ({ display: [["Package manager", "npm"]] }),
          plannedPaths: () => ["package.json"],
          createFiles: () => {
            throw new Error("createFiles should not run during dry-run");
          },
          writeConfig: () => {
            throw new Error("writeConfig should not run during dry-run");
          },
          nextSteps: [],
        }),
      ).resolves.toBeUndefined();
    } finally {
      process.stdin.isTTY = stdin;
      process.stdout.isTTY = stdout;
    }
  });
});
