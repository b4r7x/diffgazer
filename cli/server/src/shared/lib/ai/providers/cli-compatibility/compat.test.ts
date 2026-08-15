import { type ChildProcess, execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertParserEventKindAllowlisted,
  assertParserFieldPathAllowlisted,
  buildCliChildEnvironment,
  CLI_CHILD_ENV_ALLOWLIST,
  CLI_CREDENTIAL_ENV_KEYS,
  type CliCompatibilityRecord,
  type CliCompatibilityTuple,
  CliParserAllowlistError,
  findCliEnvironmentViolations,
  HOSTILE_ATTEMPT_IDS,
  matchCliCompatibilityTuple,
  parseCliCompatibilityRecord,
  redactCliCompatibilityRecord,
  runCliArgvProcess,
  terminateCliProcessGroup,
  validateCliChildEnvironment,
} from "./compat.js";

const SHA = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const SHA_E = "e".repeat(64);
const SHA_F = "f".repeat(64);
const SHA_G = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SHA_H = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const execFileAsync = promisify(execFile);

function createValidRecord(
  overrides: Partial<CliCompatibilityRecord> = {},
): CliCompatibilityRecord {
  const base: CliCompatibilityRecord = {
    schemaVersion: 1,
    provider: "codex-cli",
    observedAt: "2026-01-01T00:00:00.000Z",
    platform: {
      nodePlatform: process.platform,
      architecture: process.arch,
      osReleaseDigest: SHA,
    },
    executable: {
      realPathDigest: SHA_B,
      fileSha256: SHA_C,
      version: {
        value: "0.42.0",
        acquisitionArgv: ["codex", "--version"],
        rawOutputSha256: SHA_D,
      },
    },
    auth: {
      mode: "vendor-managed-local-auth",
      credentialPassedByDiffgazer: false,
      authStoreEvidence: "vendor-managed-user-owned",
    },
    model: {
      requested: "gpt-4.1",
      policyCheck: "accepted",
      rawOutputSha256: SHA_E,
    },
    profile: {
      argv: [
        "codex",
        "exec",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--json",
        "--output-schema",
        "/tmp/review-schema.json",
        "--output-last-message",
        "/tmp/result.json",
        "--model",
        "gpt-4.1",
        "Return JSON",
      ],
      acceptedFlags: [
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--json",
        "--output-schema",
        "--output-last-message",
        "--model",
      ],
      workingDirectoryKind: "neutral-disposable-fixture",
    },
    positiveFixture: {
      exitCode: 0,
      stdoutJsonlSha256: SHA_F,
      reviewSchemaSha256: SHA_G,
      terminal: {
        source: "codex-output-last-message",
        acceptedEventKinds: [],
        acceptedFieldPaths: ["findings", "status"],
        resultTextFieldPath: "findings",
        parserResult: "accepted",
      },
    },
    negativeFixture: {
      attemptIds: [...HOSTILE_ATTEMPT_IDS],
      beforeTreeSha256: SHA_H,
      afterTreeSha256: SHA_H,
      treeUnchanged: true,
      localNetworkConnections: 0,
      observedToolOrActionKinds: [],
      passed: true,
    },
  };

  return {
    ...base,
    ...overrides,
    platform: { ...base.platform, ...overrides.platform },
    executable: {
      ...base.executable,
      ...overrides.executable,
      version: { ...base.executable.version, ...overrides.executable?.version },
    },
    auth: { ...base.auth, ...overrides.auth },
    model: { ...base.model, ...overrides.model },
    profile: { ...base.profile, ...overrides.profile },
    positiveFixture: {
      ...base.positiveFixture,
      ...overrides.positiveFixture,
      terminal: {
        ...base.positiveFixture.terminal,
        ...overrides.positiveFixture?.terminal,
      },
    },
    negativeFixture: { ...base.negativeFixture, ...overrides.negativeFixture },
  };
}

function createTuple(record: CliCompatibilityRecord): CliCompatibilityTuple {
  return {
    provider: record.provider,
    platform: {
      nodePlatform: record.platform.nodePlatform,
      architecture: record.platform.architecture,
    },
    executable: {
      realPathDigest: record.executable.realPathDigest,
      fileSha256: record.executable.fileSha256,
      version: record.executable.version.value,
    },
    modelId: record.model.requested,
    reviewSchemaSha256: record.positiveFixture.reviewSchemaSha256,
  };
}

const tempDirs: string[] = [];

function createFakeChild(pid = 4321) {
  const stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
  const stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
  const stdin = Object.assign(new EventEmitter(), {
    write: vi.fn(() => true),
    end: vi.fn(),
  });
  const child = Object.assign(new EventEmitter(), {
    pid,
    stdin,
    stdout,
    stderr,
    kill: vi.fn(() => true),
  }) as unknown as ChildProcess;
  return { child, stdout, stderr, stdin };
}

function killProcessGroup(pid: number | undefined): void {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // The group may already have exited.
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // The leader may already have exited.
  }
}

afterEach(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("CliCompatibilityRecord parsing and evidence", () => {
  it("accepts a complete v1 compatibility record", () => {
    const parsed = parseCliCompatibilityRecord(createValidRecord());
    expect(parsed.ok).toBe(true);
  });

  it("rejects absent compatibility record during tuple matching", () => {
    const tuple = createTuple(createValidRecord());
    expect(matchCliCompatibilityTuple(null, tuple)).toEqual({
      matched: false,
      reason: "record-absent",
    });
  });

  it("rejects schema-invalid compatibility record", () => {
    const tuple = createTuple(createValidRecord());
    expect(
      matchCliCompatibilityTuple(
        { schemaVersion: 2, provider: "codex-cli" } as unknown as CliCompatibilityRecord,
        tuple,
      ),
    ).toEqual({
      matched: false,
      reason: "schema-invalid",
    });
  });
});

describe("CliCompatibilityRecord exact tuple matching", () => {
  it.each([
    [
      "provider-mismatch",
      (tuple: CliCompatibilityTuple) => ({ ...tuple, provider: "copilot-cli" as const }),
    ],
    [
      "platform-mismatch",
      (tuple: CliCompatibilityTuple) => ({
        ...tuple,
        platform: { ...tuple.platform, nodePlatform: "other-platform" },
      }),
    ],
    [
      "architecture-mismatch",
      (tuple: CliCompatibilityTuple) => ({
        ...tuple,
        platform: { ...tuple.platform, architecture: "other-arch" },
      }),
    ],
    [
      "real-path-digest-mismatch",
      (tuple: CliCompatibilityTuple) => ({
        ...tuple,
        executable: { ...tuple.executable, realPathDigest: SHA },
      }),
    ],
    [
      "file-sha256-mismatch",
      (tuple: CliCompatibilityTuple) => ({
        ...tuple,
        executable: { ...tuple.executable, fileSha256: SHA },
      }),
    ],
    [
      "version-mismatch",
      (tuple: CliCompatibilityTuple) => ({
        ...tuple,
        executable: { ...tuple.executable, version: "9.9.9" },
      }),
    ],
    ["model-mismatch", (tuple: CliCompatibilityTuple) => ({ ...tuple, modelId: "other-model" })],
    [
      "review-schema-mismatch",
      (tuple: CliCompatibilityTuple) => ({ ...tuple, reviewSchemaSha256: SHA }),
    ],
  ])("rejects %s", (reason, mutateTuple) => {
    const record = createValidRecord();
    const tuple = mutateTuple(createTuple(record));
    expect(matchCliCompatibilityTuple(record, tuple)).toEqual({
      matched: false,
      reason,
    });
  });

  it("rejects unavailable auth evidence", () => {
    const record = createValidRecord({
      auth: {
        mode: "vendor-managed-local-auth",
        credentialPassedByDiffgazer: false,
        authStoreEvidence: "unavailable",
      },
    });
    const tuple = createTuple(createValidRecord());
    expect(matchCliCompatibilityTuple(record, tuple)).toEqual({
      matched: false,
      reason: "auth-evidence-mismatch",
    });
  });

  it("rejects tampered negative fixture evidence after schema parse", () => {
    const record = createValidRecord();
    const tuple = createTuple(record);
    const tampered = {
      ...record,
      negativeFixture: {
        ...record.negativeFixture,
        passed: false as true,
      },
    };
    expect(matchCliCompatibilityTuple(tampered, tuple)).toEqual({
      matched: false,
      reason: "schema-invalid",
    });
  });

  it("rejects compatibility evidence that observed an out-of-fixture read", () => {
    const record = createValidRecord({
      negativeFixture: {
        ...createValidRecord().negativeFixture,
        observedToolOrActionKinds: ["out-of-fixture-read"],
      },
    });

    expect(matchCliCompatibilityTuple(record, createTuple(record))).toEqual({
      matched: false,
      reason: "evidence-invalid",
    });
  });

  it.each([
    {
      provider: "codex-cli" as const,
      argv: ["exec", "--sandbox", "read-only"],
      acceptedFlags: ["--sandbox", "read-only"],
      terminalSource: "codex-output-last-message" as const,
    },
    {
      provider: "copilot-cli" as const,
      argv: ["--available-tools=view,glob,grep"],
      acceptedFlags: ["--available-tools=view,glob,grep"],
      terminalSource: "copilot-jsonl" as const,
    },
  ])("rejects the current $provider read-capable profile with empty action evidence", (profile) => {
    const base = createValidRecord();
    const record = createValidRecord({
      provider: profile.provider,
      profile: {
        argv: profile.argv,
        acceptedFlags: profile.acceptedFlags,
        workingDirectoryKind: "neutral-disposable-fixture",
      },
      positiveFixture: {
        ...base.positiveFixture,
        terminal: {
          ...base.positiveFixture.terminal,
          source: profile.terminalSource,
        },
      },
    });

    expect(record.negativeFixture.observedToolOrActionKinds).toEqual([]);
    expect(matchCliCompatibilityTuple(record, createTuple(record))).toEqual({
      matched: false,
      reason: "evidence-invalid",
    });
  });

  it("rejects credentialPassedByDiffgazer evidence", () => {
    const record = createValidRecord();
    const tuple = createTuple(createValidRecord());
    const tampered = {
      ...record,
      auth: {
        ...record.auth,
        credentialPassedByDiffgazer: true as false,
      },
    };
    expect(matchCliCompatibilityTuple(tampered, tuple)).toEqual({
      matched: false,
      reason: "schema-invalid",
    });
  });

  it("matches an exact tuple when every identity field aligns", () => {
    const record = createValidRecord();
    const tuple = createTuple(record);
    expect(matchCliCompatibilityTuple(record, tuple)).toEqual({ matched: true });
  });
});

describe("CLI parser allowlist", () => {
  it("rejects unrecorded terminal field paths fail-closed", () => {
    const record = createValidRecord();
    expect(() => assertParserFieldPathAllowlisted(record, "unknown.path")).toThrow(
      CliParserAllowlistError,
    );
  });

  it("rejects unrecorded terminal event kinds fail-closed", () => {
    const record = createValidRecord({
      provider: "copilot-cli",
      positiveFixture: {
        exitCode: 0,
        stdoutJsonlSha256: SHA_F,
        reviewSchemaSha256: SHA_G,
        terminal: {
          source: "copilot-jsonl",
          acceptedEventKinds: ["result"],
          acceptedFieldPaths: ["data.review"],
          resultTextFieldPath: "data.review",
          parserResult: "accepted",
        },
      },
    });
    expect(() => assertParserEventKindAllowlisted(record, "completion")).toThrow(
      CliParserAllowlistError,
    );
  });
});

describe("CLI child environment validation", () => {
  it.each(CLI_CREDENTIAL_ENV_KEYS)("rejects credential env key %s", (key) => {
    const violations = findCliEnvironmentViolations({
      PATH: "/usr/bin",
      HOME: process.env.HOME ?? "/home/user",
      [key]: "secret-value",
    });
    expect(
      violations.some((entry) => entry.code === "credential-env-key" && entry.key === key),
    ).toBe(true);
    expect(
      validateCliChildEnvironment({
        PATH: "/usr/bin",
        HOME: process.env.HOME ?? "/home/user",
        [key]: "secret-value",
      }).ok,
    ).toBe(false);
  });

  it("rejects temporary HOME overrides away from ambient user home", () => {
    const ambientHome = process.env.HOME ?? "/home/user";
    const violations = findCliEnvironmentViolations(
      {
        PATH: "/usr/bin",
        HOME: path.join(tmpdir(), "disposable-home"),
      },
      { ambientHome },
    );
    expect(violations.some((entry) => entry.code === "temporary-home")).toBe(true);
  });

  it("builds a narrowed ambient child environment without credential keys", () => {
    const ambientHome = process.env.HOME ?? "/home/user";
    const built = buildCliChildEnvironment(
      {
        PATH: "/usr/bin",
        HOME: ambientHome,
        USER: "tester",
        OPENAI_API_KEY: "secret",
        RANDOM_PLUGIN: "enabled",
      },
      { ambientHome },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.HOME).toBe(ambientHome);
    expect(built.value.OPENAI_API_KEY).toBeUndefined();
    expect(built.value.RANDOM_PLUGIN).toBeUndefined();
    expect(built.value.PATH).toBe("/usr/bin");
  });
});

describe("CLI compatibility redaction", () => {
  it("redacts executable paths and prompts from stored argv", () => {
    const record = createValidRecord();
    const redacted = redactCliCompatibilityRecord(record);
    expect(redacted.profile.argv.join(" ")).not.toContain("/tmp/review-schema.json");
    expect(redacted.profile.argv.join(" ")).toContain("[REDACTED]");
  });
});

describe("CLI process-group cancellation", () => {
  it("owns an ENOENT spawn error before checking the missing pid", async () => {
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      await expect(
        runCliArgvProcess({
          executable: path.join(tmpdir(), "diffgazer-cli-command-does-not-exist"),
          argv: [],
          cwd: process.cwd(),
          env: { PATH: process.env.PATH ?? "/usr/bin", HOME: process.env.HOME ?? "/home/user" },
          timeoutMs: 25,
        }),
      ).rejects.toMatchObject({ code: "ENOENT" });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.removeListener("unhandledRejection", onUnhandledRejection);
    }
  });

  it("removes output and stdin listeners after a successful run", async () => {
    const fake = createFakeChild();
    const result = await runCliArgvProcess(
      {
        executable: process.execPath,
        argv: [],
        cwd: process.cwd(),
        env: { PATH: process.env.PATH ?? "/usr/bin", HOME: process.env.HOME ?? "/home/user" },
        stdin: "prompt",
      },
      {
        spawn: () => {
          queueMicrotask(() => {
            fake.stdout.emit("data", "stdout");
            fake.stderr.emit("data", "stderr");
            fake.child.emit("close", 0, null);
          });
          return fake.child;
        },
      },
    );

    expect(result.stdout).toBe("stdout");
    expect(result.stderr).toBe("stderr");
    expect(fake.stdout.listenerCount("data")).toBe(0);
    expect(fake.stderr.listenerCount("data")).toBe(0);
    expect(fake.stdin.listenerCount("error")).toBe(0);
  });

  it("absorbs EPIPE and removes all stream listeners", async () => {
    const fake = createFakeChild();
    fake.stdin.write.mockImplementation(() => {
      fake.stdin.emit("error", Object.assign(new Error("broken pipe"), { code: "EPIPE" }));
      return true;
    });

    const result = await runCliArgvProcess(
      {
        executable: process.execPath,
        argv: [],
        cwd: process.cwd(),
        env: { PATH: process.env.PATH ?? "/usr/bin", HOME: process.env.HOME ?? "/home/user" },
        stdin: "prompt",
      },
      {
        spawn: () => {
          queueMicrotask(() => fake.child.emit("close", 3, null));
          return fake.child;
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(fake.stdout.listenerCount("data")).toBe(0);
    expect(fake.stderr.listenerCount("data")).toBe(0);
    expect(fake.stdin.listenerCount("error")).toBe(0);
  });

  it("removes stream listeners after timeout escalation", async () => {
    if (process.platform === "win32") {
      return;
    }

    const fake = createFakeChild();
    const processKill = vi.spyOn(process, "kill").mockImplementation(() => true);
    try {
      const result = await runCliArgvProcess(
        {
          executable: process.execPath,
          argv: [],
          cwd: process.cwd(),
          env: { PATH: process.env.PATH ?? "/usr/bin", HOME: process.env.HOME ?? "/home/user" },
          stdin: "prompt",
          timeoutMs: 1,
        },
        {
          gracefulTimeoutMs: 1,
          forcedTimeoutMs: 1,
          sleep: async () => {},
          spawn: () => fake.child,
        },
      );

      expect(result.timedOut).toBe(true);
      expect(fake.stdout.listenerCount("data")).toBe(0);
      expect(fake.stderr.listenerCount("data")).toBe(0);
      expect(fake.stdin.listenerCount("error")).toBe(0);
    } finally {
      processKill.mockRestore();
    }
  });

  it("rejects when forced kill never produces close instead of claiming termination", async () => {
    if (process.platform === "win32") {
      return;
    }

    const processKill = vi.spyOn(process, "kill").mockImplementation(() => true);
    const child = Object.assign(new EventEmitter(), {
      exitCode: null,
      signalCode: null,
      kill: () => true,
    }) as unknown as ChildProcess;

    try {
      await expect(
        terminateCliProcessGroup(
          { pid: 4321, child, exited: false, descendantsExited: false },
          [],
          { gracefulTimeoutMs: 1, forcedTimeoutMs: 1, sleep: async () => {} },
        ),
      ).rejects.toThrow("CLI process termination could not be confirmed");
      expect(processKill).toHaveBeenCalled();
    } finally {
      processKill.mockRestore();
    }
  });

  it("settles a run when an ineffective forced kill leaves the child without close", async () => {
    if (process.platform === "win32") {
      return;
    }

    const processKill = vi.spyOn(process, "kill").mockImplementation(() => true);
    const child = Object.assign(new EventEmitter(), {
      pid: 4321,
      exitCode: null,
      signalCode: null,
      kill: () => true,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
    }) as unknown as ChildProcess;
    const ambientHome = process.env.HOME ?? "/home/user";

    try {
      const result = await runCliArgvProcess(
        {
          executable: process.execPath,
          argv: ["-e", "setInterval(() => {}, 1000)"],
          cwd: process.cwd(),
          env: { PATH: process.env.PATH ?? "/usr/bin", HOME: ambientHome },
          timeoutMs: 1,
        },
        {
          spawn: () => child,
          gracefulTimeoutMs: 1,
          forcedTimeoutMs: 1,
          sleep: async () => {},
        },
      );

      expect(result).toMatchObject({
        exitCode: null,
        signal: null,
        timedOut: true,
        descendantsTerminatedLocally: false,
      });
      expect(child.listenerCount("close")).toBe(0);
      expect(child.listenerCount("error")).toBe(0);
    } finally {
      processKill.mockRestore();
    }
  });

  it("waits for descendant processes and claims only local termination", async () => {
    if (process.platform === "win32") {
      return;
    }

    const childScript = `
        import { spawn } from "node:child_process";
        const grandchild = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 5000)"]);
        console.log(String(grandchild.pid));
        process.on("SIGTERM", () => {});
        setInterval(() => {}, 5000);
      `;

    const child = spawn(process.execPath, ["--input-type=module", "--eval", childScript], {
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const stdoutChunks: string[] = [];
    const onStdoutData = (chunk: string) => stdoutChunks.push(chunk);
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", onStdoutData);

    try {
      child.unref();

      // Poll for the grandchild pid instead of sleeping a fixed slice: under a loaded
      // parallel suite the first stdout chunk can arrive well after 400ms.
      const deadline = Date.now() + 10_000;
      while (stdoutChunks.join("").trim().length === 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const pidText = stdoutChunks.join("").trim();
      const descendantPid = Number.parseInt(pidText, 10);
      expect(Number.isFinite(descendantPid)).toBe(true);
      if (!Number.isFinite(descendantPid)) return;

      const supervisor = {
        pid: child.pid ?? 0,
        child,
        exited: false,
        descendantsExited: false,
      };

      const termination = await terminateCliProcessGroup(supervisor, [descendantPid], {
        // Real child processes under a loaded parallel suite need headroom; a short
        // window makes `descendantsExited` a timing race rather than a contract check.
        gracefulTimeoutMs: 5_000,
        forcedTimeoutMs: 5_000,
        // The production probe bound treats a slow `ps` as an unavailable one, which on a
        // saturated machine turns the group-absence proof into the same race. Cases that
        // need the real process table say so; the bounded-probe cases keep the default.
        probeTimeoutMs: 5_000,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      });

      expect(termination.localTerminationClaimed).toBe(true);
      expect(termination.gracefulAttempted).toBe(true);
      expect(termination.forcedAttempted).toBe(true);
      expect(termination.descendantsExited).toBe(true);
    } finally {
      child.stdout?.removeListener("data", onStdoutData);
      killProcessGroup(child.pid);
    }
  });

  it("never claims descendant termination on win32 when no descendants are observed", async () => {
    const realPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    try {
      const child = Object.assign(new EventEmitter(), {
        kill: () => true,
      }) as unknown as ChildProcess;

      await expect(
        terminateCliProcessGroup({ pid: 4321, child, exited: true, descendantsExited: false }, []),
      ).rejects.toThrow("CLI process termination could not be confirmed");
    } finally {
      Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
    }
  });

  it("does not claim descendant termination for a successful win32 leader close", async () => {
    const realPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    const fake = createFakeChild();
    try {
      const result = await runCliArgvProcess(
        {
          executable: process.execPath,
          argv: [],
          cwd: process.cwd(),
          env: { PATH: process.env.PATH ?? "/usr/bin", HOME: process.env.HOME ?? "/home/user" },
        },
        {
          spawn: () => {
            queueMicrotask(() => fake.child.emit("close", 0, null));
            return fake.child;
          },
          sleep: async () => {},
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.descendantsTerminatedLocally).toBe(false);
      expect(fake.child.kill).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
    }
  });

  it("signals observed win32 descendants without signalling a closed leader", async () => {
    const realPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    const descendantPid = 9876;
    const processKill = vi.spyOn(process, "kill").mockImplementation(((pid, signal) => {
      if (pid === descendantPid && signal === 0) {
        throw Object.assign(new Error("descendant is gone"), { code: "ESRCH" });
      }
      return true;
    }) as typeof process.kill);
    const child = Object.assign(new EventEmitter(), {
      kill: vi.fn(() => true),
    }) as unknown as ChildProcess;

    try {
      await expect(
        terminateCliProcessGroup(
          { pid: 4321, child, exited: true, descendantsExited: false },
          [descendantPid],
          { sleep: async () => {} },
        ),
      ).rejects.toThrow("CLI process termination could not be confirmed");
      expect(processKill).toHaveBeenCalledWith(descendantPid, "SIGKILL");
      expect(child.kill).not.toHaveBeenCalled();
    } finally {
      processKill.mockRestore();
      Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
    }
  });

  it("uses the live leader close state when escalating on win32", async () => {
    const realPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    const descendantPid = 9876;
    const processKill = vi.spyOn(process, "kill").mockImplementation(() => true);
    const child = Object.assign(new EventEmitter(), {
      kill: vi.fn((signal: "SIGTERM" | "SIGKILL") => {
        if (signal === "SIGTERM") child.emit("close", 0, signal);
        return true;
      }),
    }) as unknown as ChildProcess;

    try {
      await expect(
        terminateCliProcessGroup(
          { pid: 4321, child, exited: false, descendantsExited: false },
          [descendantPid],
          { gracefulTimeoutMs: 10, forcedTimeoutMs: 10, sleep: async () => {} },
        ),
      ).rejects.toThrow("CLI process termination could not be confirmed");
      expect(child.kill).toHaveBeenCalledTimes(1);
      expect(child.kill).toHaveBeenCalledWith("SIGTERM");
      expect(child.kill).not.toHaveBeenCalledWith("SIGKILL");
      expect(processKill).toHaveBeenCalledWith(descendantPid, "SIGKILL");
    } finally {
      processKill.mockRestore();
      Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
    }
  });

  it("does not signal a closed win32 leader or leak observer listeners", async () => {
    const realPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on("unhandledRejection", onUnhandledRejection);
    const child = Object.assign(new EventEmitter(), {
      kill: vi.fn(() => {
        child.emit("error", new Error("kill failed"));
        return true;
      }),
    }) as unknown as ChildProcess;

    try {
      const controlledRejections: unknown[] = [];
      try {
        await terminateCliProcessGroup(
          { pid: 4321, child, exited: true, descendantsExited: false },
          [],
          { sleep: async () => {} },
        );
      } catch (error) {
        controlledRejections.push(error);
      }
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(controlledRejections).toHaveLength(1);
      expect(controlledRejections[0]).toMatchObject({
        message: "CLI process termination could not be confirmed",
      });
      expect(unhandledRejections).toEqual([]);
      expect(child.kill).not.toHaveBeenCalled();
      expect(child.listenerCount("error")).toBe(0);
      expect(child.listenerCount("close")).toBe(0);
    } finally {
      process.removeListener("unhandledRejection", onUnhandledRejection);
      Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
    }
  });

  it("absorbs a delayed direct-child kill error after the exit observer is cleaned up", async () => {
    if (process.platform === "win32") {
      return;
    }

    const unhandledErrors: unknown[] = [];
    const onUncaughtException = (error: unknown) => {
      unhandledErrors.push(error);
    };
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on("uncaughtException", onUncaughtException);
    process.on("unhandledRejection", onUnhandledRejection);
    const processKill = vi.spyOn(process, "kill").mockImplementation(((pid, signal) => {
      if (pid === -4321) {
        throw Object.assign(new Error("group is gone"), { code: "ESRCH" });
      }
      if (signal === 0) {
        throw Object.assign(new Error("descendant is gone"), { code: "ESRCH" });
      }
      return true;
    }) as typeof process.kill);
    const child = Object.assign(new EventEmitter(), {
      kill: vi.fn(() => {
        setImmediate(() => child.emit("error", new Error("delayed kill failed")));
        return true;
      }),
    }) as unknown as ChildProcess;

    try {
      await expect(
        terminateCliProcessGroup(
          { pid: 4321, child, exited: false, descendantsExited: false },
          [],
          { gracefulTimeoutMs: 1, forcedTimeoutMs: 1, sleep: async () => {} },
        ),
      ).rejects.toThrow("CLI process termination could not be confirmed");
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(unhandledErrors).toEqual([]);
      expect(unhandledRejections).toEqual([]);
      expect(child.listenerCount("error")).toBe(0);
      expect(child.listenerCount("close")).toBe(0);
      expect(child.kill).toHaveBeenCalledTimes(2);
    } finally {
      processKill.mockRestore();
      process.removeListener("uncaughtException", onUncaughtException);
      process.removeListener("unhandledRejection", onUnhandledRejection);
    }
  });

  it("bounds a hung process-group probe after successful leader close", async () => {
    if (process.platform === "win32") {
      return;
    }

    const probeDir = await mkdtemp(path.join(tmpdir(), "diffgazer-hung-ps-"));
    tempDirs.push(probeDir);
    const probePidPath = path.join(probeDir, "ps.pid");
    const probePath = path.join(probeDir, "ps");
    await writeFile(
      probePath,
      `#!${process.execPath}
const { writeFileSync } = require("node:fs");
writeFileSync(${JSON.stringify(probePidPath)}, String(process.pid));
setInterval(() => {}, 30_000);
`,
      { mode: 0o755 },
    );

    const previousPath = process.env.PATH;
    process.env.PATH = `${probeDir}${path.delimiter}${previousPath ?? ""}`;
    const fake = createFakeChild();
    const startedAt = Date.now();
    let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
    let probePid: number | undefined;
    const killProbe = async () => {
      probePid ??= await readFile(probePidPath, "utf8")
        .then((value) => Number.parseInt(value, 10))
        .catch(() => undefined);
      if (probePid === undefined || !Number.isInteger(probePid) || probePid <= 0) return;
      try {
        process.kill(probePid, "SIGKILL");
      } catch {
        // The bounded probe normally killed it already.
      }
    };

    try {
      const runPromise = runCliArgvProcess(
        {
          executable: process.execPath,
          argv: [],
          cwd: process.cwd(),
          env: { PATH: previousPath ?? "/usr/bin", HOME: process.env.HOME ?? "/home/user" },
          timeoutMs: 5_000,
        },
        {
          spawn: () => {
            queueMicrotask(() => fake.child.emit("close", 0, null));
            return fake.child;
          },
          gracefulTimeoutMs: 25,
          forcedTimeoutMs: 25,
          sleep: async () => {},
        },
      ).then(
        (result) => ({ kind: "settled" as const, result }),
        (error) => ({ kind: "rejected" as const, error }),
      );
      const watchdog = new Promise<{ kind: "watchdog" }>((resolve) => {
        watchdogTimer = setTimeout(() => {
          void killProbe();
          resolve({ kind: "watchdog" });
        }, 2_000);
      });
      const outcome = await Promise.race([runPromise, watchdog]);

      expect(Date.now() - startedAt).toBeLessThan(2_000);
      expect(outcome.kind).toBe("settled");
      if (outcome.kind !== "settled") return;
      expect(outcome.result).toMatchObject({
        exitCode: 0,
        signal: null,
        timedOut: false,
        descendantsTerminatedLocally: false,
      });
      expect(fake.child.listenerCount("close")).toBe(0);
      expect(fake.child.listenerCount("error")).toBe(0);
    } finally {
      if (watchdogTimer !== undefined) clearTimeout(watchdogTimer);
      process.env.PATH = previousPath;
      await killProbe();
      await rm(probeDir, { recursive: true, force: true });
    }
  });

  it("does not claim local termination after an EPERM process-group signal", async () => {
    if (process.platform === "win32") {
      return;
    }

    const probeDir = await mkdtemp(path.join(tmpdir(), "diffgazer-group-signal-"));
    tempDirs.push(probeDir);
    const probePath = path.join(probeDir, "ps");
    await writeFile(
      probePath,
      `#!${process.execPath}
const args = process.argv.slice(2);
if (args.includes("-eo")) process.stdout.write(" 9988 4321\\n");
if (args.includes("-p")) process.stdout.write(" S\\n");
`,
      { mode: 0o755 },
    );
    const previousPath = process.env.PATH;
    process.env.PATH = `${probeDir}${path.delimiter}${previousPath ?? ""}`;
    const processKill = vi.spyOn(process, "kill").mockImplementation(((pid, signal) => {
      if (pid === -4321 && signal === "SIGKILL") {
        throw Object.assign(new Error("group signal denied"), { code: "EPERM" });
      }
      if (pid === 9876 && signal === 0) {
        throw Object.assign(new Error("explicit descendant exited"), { code: "ESRCH" });
      }
      return true;
    }) as typeof process.kill);
    const child = Object.assign(new EventEmitter(), {
      kill: vi.fn(() => true),
    }) as unknown as ChildProcess;

    try {
      await expect(
        terminateCliProcessGroup(
          { pid: 4321, child, exited: true, descendantsExited: false },
          [9876],
          { gracefulTimeoutMs: 1, forcedTimeoutMs: 10, sleep: async () => {} },
        ),
      ).rejects.toThrow("CLI process termination could not be confirmed");
      expect(processKill).toHaveBeenCalledWith(-4321, "SIGKILL");
      expect(child.kill).not.toHaveBeenCalled();
    } finally {
      processKill.mockRestore();
      process.env.PATH = previousPath;
      await rm(probeDir, { recursive: true, force: true });
    }
  });

  it("treats unknown descendant liveness errors as alive and rejects unconfirmed termination", async () => {
    if (process.platform === "win32") {
      return;
    }

    const descendantPid = 9876;
    const processKill = vi.spyOn(process, "kill").mockImplementation(((pid, signal) => {
      if (pid === descendantPid && signal === 0) {
        throw Object.assign(new Error("liveness probe failed"), { code: "UNKNOWN" });
      }
      return true;
    }) as typeof process.kill);
    const child = Object.assign(new EventEmitter(), {
      kill: () => true,
    }) as unknown as ChildProcess;

    try {
      await expect(
        terminateCliProcessGroup(
          { pid: 4321, child, exited: true, descendantsExited: false },
          [descendantPid],
          {
            gracefulTimeoutMs: 1,
            forcedTimeoutMs: 10,
            sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          },
        ),
      ).rejects.toThrow("CLI process termination could not be confirmed");
      expect(processKill).toHaveBeenCalledWith(-4321, "SIGKILL");
      expect(processKill).toHaveBeenCalledWith(descendantPid, "SIGKILL");
    } finally {
      processKill.mockRestore();
    }
  });

  it("clears the bounded close timer when the leader closes immediately", async () => {
    if (process.platform === "win32") {
      return;
    }

    const child = Object.assign(new EventEmitter(), {
      kill: () => true,
    }) as unknown as ChildProcess;
    const processKill = vi.spyOn(process, "kill").mockImplementation(((pid, signal) => {
      if (signal === 0) {
        throw Object.assign(new Error("descendant exited"), { code: "ESRCH" });
      }
      if (pid === -4321 && signal === "SIGTERM") {
        child.emit("close", 0, "SIGTERM");
      }
      return true;
    }) as typeof process.kill);

    try {
      const termination = await terminateCliProcessGroup(
        { pid: 4321, child, exited: false, descendantsExited: false },
        [9876],
        // Signals are mocked, but the group enumeration still reads the real process
        // table, and the claim below needs that read to succeed rather than time out.
        { gracefulTimeoutMs: 10_000, forcedTimeoutMs: 10_000, probeTimeoutMs: 5_000 },
      );

      expect(termination.localTerminationClaimed).toBe(true);
    } finally {
      processKill.mockRestore();
    }
  });

  it("uses the live leader close state for POSIX forced escalation", async () => {
    if (process.platform === "win32") {
      return;
    }

    const probeDir = await mkdtemp(path.join(tmpdir(), "diffgazer-live-close-"));
    tempDirs.push(probeDir);
    const probePath = path.join(probeDir, "ps");
    await writeFile(
      probePath,
      `#!${process.execPath}
const args = process.argv.slice(2);
if (args.includes("-eo")) process.stdout.write(" 9988 4321\\n");
if (args.includes("-p")) process.stdout.write(" S\\n");
`,
      { mode: 0o755 },
    );
    const previousPath = process.env.PATH;
    process.env.PATH = `${probeDir}${path.delimiter}${previousPath ?? ""}`;
    const descendantPid = 9876;
    const child = Object.assign(new EventEmitter(), {
      kill: vi.fn(),
    }) as unknown as ChildProcess;
    const processKill = vi.spyOn(process, "kill").mockImplementation(((pid, signal) => {
      if (pid === -4321 && signal === "SIGTERM") {
        child.emit("close", 0, signal);
        return true;
      }
      if (pid === -4321 && signal === "SIGKILL") {
        throw Object.assign(new Error("group signal denied"), { code: "EPERM" });
      }
      return true;
    }) as typeof process.kill);

    try {
      await expect(
        terminateCliProcessGroup(
          { pid: 4321, child, exited: false, descendantsExited: false },
          [descendantPid],
          { gracefulTimeoutMs: 10, forcedTimeoutMs: 10, sleep: async () => {} },
        ),
      ).rejects.toThrow("CLI process termination could not be confirmed");
      expect(child.kill).not.toHaveBeenCalled();
      expect(processKill).toHaveBeenCalledWith(-4321, "SIGTERM");
      expect(processKill).toHaveBeenCalledWith(-4321, "SIGKILL");
      expect(processKill).toHaveBeenCalledWith(descendantPid, "SIGKILL");
    } finally {
      processKill.mockRestore();
      process.env.PATH = previousPath;
    }
  });

  it("waits for forced descendant cleanup before propagating an in-flight kill error", async () => {
    if (process.platform === "win32") {
      return;
    }

    const probeDir = await mkdtemp(path.join(tmpdir(), "diffgazer-run-kill-error-"));
    tempDirs.push(probeDir);
    const probePath = path.join(probeDir, "ps");
    await writeFile(
      probePath,
      `#!${process.execPath}
const args = process.argv.slice(2);
if (args.includes("-eo")) process.stdout.write(" 9988 4321\\n");
if (args.includes("-p")) process.stdout.write(" S\\n");
`,
      { mode: 0o755 },
    );
    const previousPath = process.env.PATH;
    process.env.PATH = `${probeDir}${path.delimiter}${previousPath ?? ""}`;
    const descendantPid = 9988;
    let descendantAlive = true;
    let runSettled = false;
    let forcedDescendantSignalBeforeSettlement = false;
    const directKillError = Object.assign(new Error("direct child kill denied"), { code: "EPERM" });
    const child = createFakeChild(4321);
    const childKill = vi.fn((signal: NodeJS.Signals) => {
      if (signal === "SIGTERM") child.child.emit("error", directKillError);
      return true;
    });
    child.child.kill = childKill;
    const processKill = vi.spyOn(process, "kill").mockImplementation(((pid, signal) => {
      if (pid === -4321 && signal === "SIGTERM") {
        throw Object.assign(new Error("process group signal denied"), { code: "EPERM" });
      }
      if (pid === descendantPid && signal === 0) {
        if (descendantAlive) return true;
        throw Object.assign(new Error("descendant exited"), { code: "ESRCH" });
      }
      if (pid === descendantPid && signal === "SIGKILL") {
        forcedDescendantSignalBeforeSettlement ||= !runSettled;
        descendantAlive = false;
      }
      return true;
    }) as typeof process.kill);

    try {
      const settled = runCliArgvProcess(
        {
          executable: process.execPath,
          argv: [],
          cwd: process.cwd(),
          env: { PATH: previousPath ?? "/usr/bin", HOME: process.env.HOME ?? "/home/user" },
          timeoutMs: 1,
        },
        {
          spawn: () => child.child,
          gracefulTimeoutMs: 10,
          forcedTimeoutMs: 10,
          sleep: async () => {},
        },
      ).then(
        (result) => {
          runSettled = true;
          return { kind: "result" as const, result };
        },
        (error) => {
          runSettled = true;
          return { kind: "error" as const, error };
        },
      );
      const outcome = await settled;

      expect(outcome.kind).toBe("error");
      if (outcome.kind !== "error") return;
      expect(outcome.error).toBe(directKillError);
      expect(forcedDescendantSignalBeforeSettlement).toBe(true);
      expect(processKill).toHaveBeenCalledWith(descendantPid, "SIGKILL");
      expect(descendantAlive).toBe(false);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(child.child.listenerCount("error")).toBe(0);
      expect(child.child.listenerCount("close")).toBe(0);
    } finally {
      processKill.mockRestore();
      process.env.PATH = previousPath;
    }
  });

  it("waits for close after exit before settling the run", async () => {
    const child = Object.assign(new EventEmitter(), {
      pid: 4321,
      exitCode: null,
      signalCode: null,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
    }) as unknown as ChildProcess;
    let closeObserved = false;

    const result = await runCliArgvProcess(
      {
        executable: process.execPath,
        argv: [],
        cwd: process.cwd(),
        env: { PATH: process.env.PATH ?? "/usr/bin", HOME: process.env.HOME ?? "/home/user" },
        timeoutMs: 500,
      },
      {
        spawn: () => {
          setTimeout(() => {
            (child as unknown as { exitCode: number }).exitCode = 0;
            child.emit("exit", 0, null);
          }, 0);
          setTimeout(() => {
            closeObserved = true;
            child.emit("close", 0, null);
          }, 20);
          return child;
        },
      },
    );

    expect(closeObserved).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(child.listenerCount("close")).toBe(0);
    expect(child.listenerCount("error")).toBe(0);
  });

  it("clears the delayed termination timer after a spawn error", async () => {
    const fake = createFakeChild();
    const processKill = vi.spyOn(process, "kill").mockImplementation(() => true);
    const spawnError = new Error("spawn failed");

    try {
      await expect(
        runCliArgvProcess(
          {
            executable: process.execPath,
            argv: [],
            cwd: process.cwd(),
            env: { PATH: process.env.PATH ?? "/usr/bin", HOME: process.env.HOME ?? "/home/user" },
            timeoutMs: 25,
          },
          {
            spawn: () => {
              setTimeout(() => fake.child.emit("error", spawnError), 0);
              return fake.child;
            },
          },
        ),
      ).rejects.toBe(spawnError);

      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(fake.child.kill).not.toHaveBeenCalled();
      expect(processKill).not.toHaveBeenCalled();
      expect(fake.child.listenerCount("close")).toBe(0);
      expect(fake.child.listenerCount("error")).toBe(0);
      expect(fake.stdout.listenerCount("data")).toBe(0);
      expect(fake.stderr.listenerCount("data")).toBe(0);
      expect(fake.stdin.listenerCount("error")).toBe(0);
    } finally {
      processKill.mockRestore();
    }
  });

  it("runs CLI argv without a shell and redacts captured output", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "cli-run-"));
    tempDirs.push(cwd);
    const ambientHome = process.env.HOME ?? "/home/user";
    const env = buildCliChildEnvironment(
      {
        PATH: process.env.PATH ?? "/usr/bin",
        HOME: ambientHome,
      },
      { ambientHome },
    );
    expect(env.ok).toBe(true);
    if (!env.ok) return;

    const result = await runCliArgvProcess({
      executable: process.execPath,
      argv: ["-e", "console.log('Bearer sk-test-token-value')"],
      cwd,
      env: env.value,
    });

    expect(result.stdout).toContain("[REDACTED]");
    expect(result.stdout).not.toContain("sk-test-token-value");
    expect(result.cancelledLocally).toBe(false);
  });
});

describe("CLI child environment capability boundary", () => {
  // REQ-041: the child environment must never carry a live capability handle
  // (agent sockets, display servers). Matched by pattern so re-adding any
  // variant of those keys fails here.
  const FORBIDDEN_CAPABILITY_KEY_PATTERN = /AUTH_SOCK|DISPLAY|AGENT_PID|GPG_TTY/;

  it("keeps live capability handles out of the child env allowlist", () => {
    expect(
      (CLI_CHILD_ENV_ALLOWLIST as readonly string[]).filter((key) =>
        FORBIDDEN_CAPABILITY_KEY_PATTERN.test(key),
      ),
    ).toEqual([]);
  });

  it("drops ambient capability handles when building the child env", () => {
    const ambientHome = process.env.HOME ?? "/home/user";
    const built = buildCliChildEnvironment(
      {
        PATH: process.env.PATH ?? "/usr/bin",
        HOME: ambientHome,
        WAYLAND_DISPLAY: "wayland-0",
        DISPLAY: ":0",
      },
      { ambientHome },
    );

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(
      Object.keys(built.value).filter((key) => FORBIDDEN_CAPABILITY_KEY_PATTERN.test(key)),
    ).toEqual([]);
  });
});

describe("CLI process bounds", () => {
  const childEnv = () => {
    const ambientHome = process.env.HOME ?? "/home/user";
    const env = buildCliChildEnvironment(
      { PATH: process.env.PATH ?? "/usr/bin", HOME: ambientHome },
      { ambientHome },
    );
    if (!env.ok) throw new Error("child environment rejected");
    return env.value;
  };

  it("truncates transcripts at the output bound instead of buffering without limit", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "cli-bounds-"));
    tempDirs.push(cwd);

    const result = await runCliArgvProcess({
      executable: process.execPath,
      argv: ["-e", "process.stdout.write('x'.repeat(50000))"],
      cwd,
      env: childEnv(),
      maxOutputBytes: 1024,
    });

    expect(result.outputTruncated).toBe(true);
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(1024);
  });

  it("keeps multibyte output valid while enforcing the byte ceiling", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "cli-utf8-bounds-"));
    tempDirs.push(cwd);

    const result = await runCliArgvProcess({
      executable: process.execPath,
      argv: ["-e", "process.stdout.write('é'); process.stderr.write('é')"],
      cwd,
      env: childEnv(),
      maxOutputBytes: 1,
    });

    expect(result.outputTruncated).toBe(true);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(1);
    expect(Buffer.byteLength(result.stderr, "utf8")).toBeLessThanOrEqual(1);
  });

  it("settles a run whose child exits before draining the stdin prompt", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "cli-bounds-"));
    tempDirs.push(cwd);

    // Without an 'error' listener on child.stdin the EPIPE raised here escapes as
    // an unhandled event and terminates the server process instead of the run.
    const result = await runCliArgvProcess({
      executable: process.execPath,
      argv: ["-e", "process.exit(3)"],
      cwd,
      env: childEnv(),
      stdin: "p".repeat(4_000_000),
    });

    expect(result.exitCode).toBe(3);
    expect(result.timedOut).toBe(false);
  });

  it("terminates and reports a run that exceeds the wall-time bound", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "cli-bounds-"));
    tempDirs.push(cwd);

    const result = await runCliArgvProcess(
      {
        executable: process.execPath,
        argv: ["-e", "setInterval(() => {}, 1000)"],
        cwd,
        env: childEnv(),
        timeoutMs: 200,
      },
      { gracefulTimeoutMs: 1_000, forcedTimeoutMs: 1_000 },
    );

    expect(result.timedOut).toBe(true);
    expect(result.exitCode === null || result.exitCode !== 0).toBe(true);
  });

  it("discovers descendants when production termination receives no explicit pid list", async () => {
    if (process.platform === "win32") {
      return;
    }

    const cwd = await mkdtemp(path.join(tmpdir(), "cli-tree-bounds-"));
    tempDirs.push(cwd);
    const childScript = `
      import { spawn } from "node:child_process";
      spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 5000)"]);
      process.on("SIGTERM", () => {});
      setInterval(() => {}, 5000);
    `;

    const result = await runCliArgvProcess(
      {
        executable: process.execPath,
        argv: ["--input-type=module", "--eval", childScript],
        cwd,
        env: childEnv(),
        timeoutMs: 500,
      },
      // Graceful stays short so SIGTERM-ignoring processes must escalate, but the forced
      // window and the process-table probe get the same headroom as the other real-process
      // cases in this file: both are deadlines, so a wide bound only matters on a loaded
      // parallel suite, where a narrow one turns `descendantsExited` into a race.
      { gracefulTimeoutMs: 100, forcedTimeoutMs: 5_000, probeTimeoutMs: 5_000 },
    );

    expect(result.timedOut).toBe(true);
    expect(result.descendantsTerminatedLocally).toBe(true);
  });

  it("waits for an ignored-stdio descendant after a successful leader exit", async () => {
    if (process.platform === "win32") {
      return;
    }

    const cwd = await mkdtemp(path.join(tmpdir(), "cli-success-tree-"));
    tempDirs.push(cwd);
    const pidPath = path.join(cwd, "descendant.pid");
    const leaderPidPath = path.join(cwd, "leader.pid");
    const ambientHome = process.env.HOME ?? "/home/user";
    const env = buildCliChildEnvironment(
      { PATH: process.env.PATH ?? "/usr/bin", HOME: ambientHome },
      { ambientHome },
    );
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    let descendantPid: number | undefined;
    let leaderPid: number | undefined;
    const childScript = `
      import { spawn } from "node:child_process";
      import { writeFileSync } from "node:fs";
      writeFileSync(${JSON.stringify(leaderPidPath)}, String(process.pid));
      const descendant = spawn(process.execPath, ["-e", "setInterval(() => {}, 5000)"], { stdio: "ignore" });
      writeFileSync(${JSON.stringify(pidPath)}, String(descendant.pid));
      descendant.unref();
    `;

    const readPid = (filePath: string): number | undefined => {
      try {
        const pid = Number.parseInt(readFileSync(filePath, "utf8"), 10);
        return Number.isInteger(pid) && pid > 0 ? pid : undefined;
      } catch {
        return undefined;
      }
    };
    const killDescendantTree = () => {
      leaderPid ??= readPid(leaderPidPath);
      descendantPid ??= readPid(pidPath);
      killProcessGroup(leaderPid);
      if (descendantPid === undefined) return;
      try {
        process.kill(descendantPid, "SIGKILL");
      } catch {
        // The descendant may already have exited with the process group.
      }
    };
    let watchdogTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      const runPromise = runCliArgvProcess(
        {
          executable: process.execPath,
          argv: ["--input-type=module", "--eval", childScript],
          cwd,
          env: env.value,
          timeoutMs: 2_000,
        },
        // Same headroom rationale as the timed-out tree case: these are deadlines, not
        // delays, so widening them costs nothing once the descendant is gone.
        { gracefulTimeoutMs: 100, forcedTimeoutMs: 5_000, probeTimeoutMs: 5_000 },
      );
      const watchdog = new Promise<never>((_, reject) => {
        watchdogTimer = setTimeout(() => {
          killDescendantTree();
          reject(new Error("normal-exit descendant cleanup watchdog expired"));
        }, 15_000);
      });
      const result = await Promise.race([runPromise, watchdog]);

      leaderPid = Number.parseInt(await readFile(leaderPidPath, "utf8"), 10);
      descendantPid = Number.parseInt(await readFile(pidPath, "utf8"), 10);
      expect(Number.isInteger(descendantPid)).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.descendantsTerminatedLocally).toBe(true);

      const processState = await execFileAsync("ps", ["-p", String(descendantPid), "-o", "state="])
        .then(({ stdout }) => stdout.trim())
        .catch(() => "");
      expect(processState === "" || processState.startsWith("Z")).toBe(true);
    } finally {
      if (watchdogTimer !== undefined) clearTimeout(watchdogTimer);
      killDescendantTree();
    }
  });

  it("awaits process-tree termination before settling a cancelled run", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "cli-bounds-"));
    tempDirs.push(cwd);

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    const result = await runCliArgvProcess(
      {
        executable: process.execPath,
        argv: ["-e", "setInterval(() => {}, 1000)"],
        cwd,
        env: childEnv(),
        signal: controller.signal,
      },
      // Real process table, so the probe bound needs the same headroom as the other
      // real-process cases; every other budget stays on its production default.
      { probeTimeoutMs: 5_000 },
    );

    expect(result.cancelledLocally).toBe(true);
    expect(result.descendantsTerminatedLocally).toBe(true);
  });
});
