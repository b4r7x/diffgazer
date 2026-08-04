import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compareFixtureTreeSnapshots,
  snapshotFixtureTree,
  verifyFixtureTreeUnchanged,
} from "../cli-fixture-hasher.js";
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
        "--sandbox",
        "read-only",
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
        "--sandbox",
        "read-only",
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

afterEach(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "cli-fixture-"));
  tempDirs.push(root);
  await mkdir(path.join(root, "nested"), { recursive: true });
  await writeFile(path.join(root, "sentinel-preserve.txt"), "PRESERVE\n");
  await writeFile(path.join(root, "sentinel-delete.txt"), "DELETE-ME\n");
  await writeFile(path.join(root, "sentinel-rename.txt"), "RENAME-ME\n");
  await writeFile(path.join(root, "nested", "unchanged.txt"), "NESTED\n");
  return root;
}

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

describe("canonical fixture tree hasher", () => {
  it("detects byte changes in fixture files", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    await writeFile(path.join(root, "sentinel-preserve.txt"), "OVERWRITTEN\n");
    const after = await snapshotFixtureTree(root);
    const verification = compareFixtureTreeSnapshots(before, after);
    expect(verification.ok).toBe(false);
    expect(verification.changedPaths).toContain("sentinel-preserve.txt");
  });

  it("detects added fixture files", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    await writeFile(path.join(root, "created-by-agent.txt"), "CREATED\n");
    const after = await snapshotFixtureTree(root);
    expect(compareFixtureTreeSnapshots(before, after).ok).toBe(false);
  });

  it("detects removed fixture files", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    await rm(path.join(root, "sentinel-delete.txt"));
    const after = await snapshotFixtureTree(root);
    expect(compareFixtureTreeSnapshots(before, after).ok).toBe(false);
  });

  it("detects renamed fixture files", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    const { rename } = await import("node:fs/promises");
    await rename(path.join(root, "sentinel-rename.txt"), path.join(root, "renamed-by-agent.txt"));
    const after = await snapshotFixtureTree(root);
    expect(compareFixtureTreeSnapshots(before, after).ok).toBe(false);
  });

  it("detects executable-bit changes", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    const { chmod } = await import("node:fs/promises");
    await chmod(path.join(root, "nested", "unchanged.txt"), 0o755);
    const after = await snapshotFixtureTree(root);
    expect(compareFixtureTreeSnapshots(before, after).ok).toBe(false);
  });

  it("verifies unchanged fixture trees with equal hashes", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    const verification = await verifyFixtureTreeUnchanged(root, before);
    expect(verification.ok).toBe(true);
    expect(verification.treeSha256).toBe(before.treeSha256);
  });
});

describe("CLI process-group cancellation", () => {
  it("waits for descendant processes and claims only local termination", async () => {
    if (process.platform === "win32") {
      return;
    }

    const childScript = `
      import { spawn } from "node:child_process";
      const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 5000)"]);
      console.log(String(grandchild.pid));
      setInterval(() => {}, 5000);
    `;

    const child = spawn(process.execPath, ["--input-type=module", "--eval", childScript], {
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    child.unref();

    const stdoutChunks: string[] = [];
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => stdoutChunks.push(chunk));

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
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });

    expect(termination.localTerminationClaimed).toBe(true);
    expect(termination.gracefulAttempted).toBe(true);
    expect(termination.descendantsExited).toBe(true);
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

  it("awaits process-tree termination before settling a cancelled run", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "cli-bounds-"));
    tempDirs.push(cwd);

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    const result = await runCliArgvProcess({
      executable: process.execPath,
      argv: ["-e", "setInterval(() => {}, 1000)"],
      cwd,
      env: childEnv(),
      signal: controller.signal,
    });

    expect(result.cancelledLocally).toBe(true);
    expect(result.descendantsTerminatedLocally).toBe(true);
  });
});
