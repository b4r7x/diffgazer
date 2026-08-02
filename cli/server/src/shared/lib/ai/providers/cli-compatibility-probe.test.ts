import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { err, ok } from "@diffgazer/core/result";
import { afterEach, describe, expect, it } from "vitest";
import { HOSTILE_ATTEMPT_IDS } from "./cli-compatibility.js";
import {
  buildHostileFixturePrompt,
  buildHostileShellCommandSnippet,
  type CliCompatibilityProbeDependencies,
  createDisposableFixtureCheckout,
  listHostileFixtureAttemptIds,
  runCliCompatibilityProbe,
  runNegativeFixtureHarness,
  startFixtureLoopbackListener,
} from "./cli-compatibility-probe.js";
import { snapshotFixtureTree } from "./cli-fixture-hasher.js";

const SHA = "a".repeat(64);

const tempDirs: string[] = [];
afterEach(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "cli-probe-fixture-"));
  tempDirs.push(root);
  await createDisposableFixtureCheckout(root);
  return root;
}

function createSuccessfulDependencies(
  overrides: Partial<CliCompatibilityProbeDependencies> = {},
): CliCompatibilityProbeDependencies {
  const executable = process.execPath;
  return {
    resolveExecutable: async () => ok(executable),
    acquireVersion: async () =>
      ok({
        value: "0.42.0",
        acquisitionArgv: [executable, "--version"],
        rawOutput: "0.42.0\n",
      }),
    probeAuth: async () => ok({ authStoreEvidence: "vendor-managed-user-owned" }),
    probeModelPolicy: async () => ok({ accepted: true, rawOutput: "model accepted" }),
    runPositiveFixture: async () =>
      ok({
        exitCode: 0,
        stdoutJsonl: '{"type":"result","issues":[]}\n',
        terminalPayload: { issues: [] },
        argv: [
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
        acceptedEventKinds: [],
        acceptedFieldPaths: ["issues"],
        resultTextFieldPath: "issues",
      }),
    runNegativeFixture: async () => ok({ observedToolOrActionKinds: [] }),
    now: () => "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function serializeProbeRecord(value: unknown): string {
  return JSON.stringify(value);
}

describe("hostile fixture roster", () => {
  it("includes every hostile attempt id in the prompt", () => {
    const prompt = buildHostileFixturePrompt(42424);
    for (const attemptId of HOSTILE_ATTEMPT_IDS) {
      expect(prompt).toContain(`[${attemptId}]`);
    }
    expect(listHostileFixtureAttemptIds()).toEqual([...HOSTILE_ATTEMPT_IDS]);
  });

  it("uses a platform-specific shell snippet", () => {
    const snippet = buildHostileShellCommandSnippet();
    if (process.platform === "win32") {
      expect(snippet).toContain("cmd /c");
    } else {
      expect(snippet).toContain("sh -c");
    }
  });
});

describe("fixture loopback listener", () => {
  it("accepts only the fixture loopback path and counts connections", async () => {
    const listener = await startFixtureLoopbackListener();
    try {
      expect(listener.connectionCount()).toBe(0);
      const response = await fetch(listener.url);
      expect(response.ok).toBe(true);
      expect(listener.connectionCount()).toBe(1);

      const ignored = await fetch(`http://127.0.0.1:${listener.port}/other`);
      expect(ignored.status).toBe(404);
      expect(listener.connectionCount()).toBe(1);
    } finally {
      await listener.close();
    }
  });
});

describe("negative fixture harness", () => {
  it("records equal tree hashes and zero listener connections", async () => {
    const fixtureRoot = await createFixtureRoot();
    const result = await runNegativeFixtureHarness({
      fixtureRoot,
      loopbackPort: 0,
      run: async () => ({ observedToolOrActionKinds: [] }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attemptIds).toEqual([...HOSTILE_ATTEMPT_IDS]);
    expect(result.value.beforeTreeSha256).toBe(result.value.afterTreeSha256);
    expect(result.value.treeUnchanged).toBe(true);
    expect(result.value.localNetworkConnections).toBe(0);
    expect(result.value.passed).toBe(true);
    expect(result.value.observedToolOrActionKinds).toEqual([]);
  });

  it("fails when the fixture tree changes", async () => {
    const fixtureRoot = await createFixtureRoot();
    const result = await runNegativeFixtureHarness({
      fixtureRoot,
      loopbackPort: 0,
      run: async () => {
        await writeFile(path.join(fixtureRoot, "created-by-agent.txt"), "CREATED\n");
        return { observedToolOrActionKinds: [] };
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("negative-fixture");
    expect(result.error.reason).toContain("created-by-agent.txt");
  });

  it("fails when the supplied loopback listener receives a connection", async () => {
    const fixtureRoot = await createFixtureRoot();
    const result = await runNegativeFixtureHarness({
      fixtureRoot,
      loopbackPort: 0,
      run: async (_prompt, loopbackUrl) => {
        await fetch(loopbackUrl);
        return { observedToolOrActionKinds: [] };
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toContain("connection");
  });

  it("fails when an unexpected tool or action kind is observed", async () => {
    const fixtureRoot = await createFixtureRoot();
    const result = await runNegativeFixtureHarness({
      fixtureRoot,
      loopbackPort: 0,
      run: async () => ({ observedToolOrActionKinds: ["write"] }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toContain("write");
  });
});

describe("runCliCompatibilityProbe", () => {
  it("builds a supported redacted record with every hostile attempt id", async () => {
    const result = await runCliCompatibilityProbe(
      { provider: "codex-cli", modelId: "gpt-4.1" },
      createSuccessfulDependencies(),
    );

    expect(result.status).toBe("supported");
    if (result.status !== "supported") return;

    expect(result.record.negativeFixture.attemptIds).toEqual([...HOSTILE_ATTEMPT_IDS]);
    expect(result.record.negativeFixture.beforeTreeSha256).toBe(
      result.record.negativeFixture.afterTreeSha256,
    );
    expect(result.record.negativeFixture.localNetworkConnections).toBe(0);
    expect(result.record.negativeFixture.treeUnchanged).toBe(true);
    expect(result.record.negativeFixture.passed).toBe(true);
    expect(result.record.negativeFixture.observedToolOrActionKinds).toEqual([]);
    expect(result.record.auth.credentialPassedByDiffgazer).toBe(false);
    expect(result.record.positiveFixture.exitCode).toBe(0);
    expect(result.record.executable.version.acquisitionArgv.length).toBeGreaterThan(0);
    expect(result.record.executable.version.rawOutputSha256).toHaveLength(64);
    expect(result.record.positiveFixture.stdoutJsonlSha256).toHaveLength(64);
    expect(result.record.positiveFixture.reviewSchemaSha256).toHaveLength(64);
  });

  it("does not surface prompt, account, path, or token output in records", async () => {
    const result = await runCliCompatibilityProbe(
      { provider: "codex-cli", modelId: "gpt-4.1" },
      createSuccessfulDependencies({
        runPositiveFixture: async () =>
          ok({
            exitCode: 0,
            stdoutJsonl: "Bearer sk-test-token-value acct_123 /Users/secret/prompt.txt\n",
            terminalPayload: { issues: [] },
            argv: [
              "exec",
              "--output-schema",
              "/Users/secret/review-schema.json",
              "--output-last-message",
              "/Users/secret/result.json",
              "--model",
              "gpt-4.1",
              "Return JSON with account_abcdef",
            ],
            acceptedFlags: ["--output-schema", "--output-last-message", "--model"],
            acceptedEventKinds: [],
            acceptedFieldPaths: ["issues"],
            resultTextFieldPath: "issues",
          }),
      }),
    );

    expect(result.status).toBe("supported");
    if (result.status !== "supported") return;

    const serialized = serializeProbeRecord(result.record);
    expect(serialized).not.toContain("sk-test-token-value");
    expect(serialized).not.toContain("/Users/secret");
    expect(serialized).not.toContain("account_abcdef");
    expect(serialized).not.toContain("Return JSON");
    expect(serialized).toContain("[REDACTED]");
  });

  it("returns explicit unsupported when version acquisition fails", async () => {
    const result = await runCliCompatibilityProbe(
      { provider: "codex-cli", modelId: "gpt-4.1" },
      createSuccessfulDependencies({
        acquireVersion: async () => err("Version acquisition failed for codex-cli"),
      }),
    );

    expect(result).toEqual({
      status: "unsupported",
      field: "version",
      reason: "Version acquisition failed for codex-cli",
    });
  });

  it("returns explicit unsupported when auth is unavailable", async () => {
    const result = await runCliCompatibilityProbe(
      { provider: "codex-cli", modelId: "gpt-4.1" },
      createSuccessfulDependencies({
        probeAuth: async () => ok({ authStoreEvidence: "unavailable" }),
      }),
    );

    expect(result).toEqual({
      status: "unsupported",
      field: "auth",
      reason: "Ambient vendor auth is unavailable",
    });
  });

  it("returns explicit unsupported when copilot plaintext fallback is detected", async () => {
    const result = await runCliCompatibilityProbe(
      { provider: "copilot-cli", modelId: "gpt-5" },
      createSuccessfulDependencies({
        probeAuth: async () => ok({ authStoreEvidence: "plaintext-fallback" }),
      }),
    );

    expect(result).toEqual({
      status: "unsupported",
      field: "auth",
      reason: "Plaintext auth-store fallback is unsupported",
    });
  });

  it("returns explicit unsupported when model policy rejects the requested model", async () => {
    const result = await runCliCompatibilityProbe(
      { provider: "codex-cli", modelId: "gpt-4.1" },
      createSuccessfulDependencies({
        probeModelPolicy: async () => ok({ accepted: false, rawOutput: "rejected" }),
      }),
    );

    expect(result).toEqual({
      status: "unsupported",
      field: "model-policy",
      reason: "Model gpt-4.1 was rejected by policy check",
    });
  });

  it("returns explicit unsupported when the positive fixture fails", async () => {
    const result = await runCliCompatibilityProbe(
      { provider: "codex-cli", modelId: "gpt-4.1" },
      createSuccessfulDependencies({
        runPositiveFixture: async () => err("Positive fixture exited with code 1"),
      }),
    );

    expect(result).toEqual({
      status: "unsupported",
      field: "positive-fixture",
      reason: "Positive fixture exited with code 1",
    });
  });

  it("returns explicit unsupported when the negative fixture observes an action", async () => {
    const result = await runCliCompatibilityProbe(
      { provider: "codex-cli", modelId: "gpt-4.1" },
      createSuccessfulDependencies({
        runNegativeFixture: async () => ok({ observedToolOrActionKinds: ["shell"] }),
      }),
    );

    expect(result).toEqual({
      status: "unsupported",
      field: "negative-fixture",
      reason: expect.stringContaining("shell"),
    });
  });

  it("returns skipped when live probes are disabled and no dependencies are injected", async () => {
    const previous = process.env.DIFFGAZER_LIVE_PROBES;
    delete process.env.DIFFGAZER_LIVE_PROBES;
    try {
      const result = await runCliCompatibilityProbe({
        provider: "codex-cli",
        modelId: "gpt-4.1",
      });
      expect(result).toEqual({ status: "skipped", reason: "live-probes-disabled" });
    } finally {
      if (previous === undefined) {
        delete process.env.DIFFGAZER_LIVE_PROBES;
      } else {
        process.env.DIFFGAZER_LIVE_PROBES = previous;
      }
    }
  });
});

describe("disposable fixture checkout", () => {
  it("creates the canonical sentinel tree used by the probe", async () => {
    const root = await createFixtureRoot();
    const snapshot = await snapshotFixtureTree(root);
    const relativePaths = snapshot.manifest.entries.map((entry) => entry.relativePath);
    expect(relativePaths).toEqual(
      expect.arrayContaining([
        "nested",
        "nested/unchanged.txt",
        "sentinel-delete.txt",
        "sentinel-preserve.txt",
        "sentinel-rename.txt",
      ]),
    );
    expect(snapshot.treeSha256).toHaveLength(64);
    expect(snapshot.treeSha256).not.toBe(SHA);
  });
});
