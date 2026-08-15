import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ok } from "@diffgazer/core/result";
import { afterEach, describe, expect, it } from "vitest";
import { buildCodexCliExecArgv, CODEX_CLI_ACCEPTED_FLAGS } from "../codex-cli.js";
import { buildCopilotCliExecArgv, COPILOT_CLI_ACCEPTED_FLAGS } from "../copilot/cli.js";
import type { CliProcessRunInput, CliProcessRunResult } from "./compat.js";
import { runCliCompatibilityProbe } from "./probe.js";
import { defaultRunPositiveFixture } from "./probe-observation.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function successfulProcessResult(stdout: string): CliProcessRunResult {
  return {
    exitCode: 0,
    signal: null,
    stdout,
    stderr: "",
    cancelledLocally: false,
    descendantsTerminatedLocally: false,
    outputTruncated: false,
    timedOut: false,
  };
}

function createProcessRunner() {
  const calls: CliProcessRunInput[] = [];
  const runProcess = async (input: CliProcessRunInput): Promise<CliProcessRunResult> => {
    calls.push(input);
    if (input.argv.includes("--output-last-message")) {
      const resultIndex = input.argv.indexOf("--output-last-message") + 1;
      await writeFile(input.argv[resultIndex] ?? "", '{"issues":[]}', "utf8");
      return successfulProcessResult("");
    }
    return successfulProcessResult('{"type":"result","issues":[]}\n');
  };
  return { calls, runProcess };
}

async function createPositiveFixtureInput() {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "cli-argv-fixture-"));
  tempDirs.push(fixtureRoot);
  return {
    fixtureRoot,
    executable: process.execPath,
    env: { PATH: process.env.PATH ?? "/usr/bin", HOME: process.env.HOME ?? "/home/user" },
    reviewSchemaPath: path.join(fixtureRoot, "review-schema.json"),
    resultPath: path.join(fixtureRoot, "result.json"),
  };
}

describe("CLI compatibility argv behavior", () => {
  it("drives Codex through the canonical argv builder and output-last-message parser", async () => {
    const input = await createPositiveFixtureInput();
    const { calls, runProcess } = createProcessRunner();
    const result = await defaultRunPositiveFixture({
      provider: "codex-cli",
      modelId: "gpt-4.1",
      ...input,
      runProcess,
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.argv).toEqual(
      buildCodexCliExecArgv({
        reviewSchemaPath: input.reviewSchemaPath,
        resultPath: input.resultPath,
        modelId: "gpt-4.1",
      }),
    );
    if (!result.ok) return;
    expect(result.value.acceptedFlags).toEqual([...CODEX_CLI_ACCEPTED_FLAGS]);
    expect(result.value.terminalPayload).toEqual({ issues: [] });
    expect(result.value.acceptedFieldPaths).toEqual(["issues"]);
    expect(result.value.resultTextFieldPath).toBe("issues");
  });

  it("drives Copilot through the canonical argv builder and shared JSONL parser", async () => {
    const input = await createPositiveFixtureInput();
    const { calls, runProcess } = createProcessRunner();
    const result = await defaultRunPositiveFixture({
      provider: "copilot-cli",
      modelId: "gpt-5",
      ...input,
      runProcess,
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.argv).toEqual(buildCopilotCliExecArgv({ modelId: "gpt-5" }));
    if (!result.ok) return;
    expect(result.value.acceptedFlags).toEqual([...COPILOT_CLI_ACCEPTED_FLAGS]);
    expect(result.value.acceptedEventKinds).toEqual(["result"]);
    expect(result.value.acceptedFieldPaths).toEqual(["issues", "type"]);
    expect(result.value.terminalPayload).toEqual({ issues: [] });
  });
});

describe("runCliCompatibilityProbe positive fixture integration", () => {
  it.each([
    { provider: "codex-cli" as const, modelId: "gpt-4.1" },
    { provider: "copilot-cli" as const, modelId: "gpt-5" },
  ])("uses default fixture behavior for $provider", async ({ provider, modelId }) => {
    const { calls, runProcess } = createProcessRunner();
    const result = await runCliCompatibilityProbe(
      { provider, modelId, executable: process.execPath },
      {
        acquireVersion: async () =>
          ok({
            value: "0.42.0",
            acquisitionArgv: [process.execPath, "--version"],
            rawOutput: "0.42.0\n",
          }),
        probeAuth: async () => ok({ authStoreEvidence: "vendor-managed-user-owned" }),
        probeModelPolicy: async () => ok({ accepted: true, rawOutput: "accepted" }),
        runPositiveFixture: (input) => defaultRunPositiveFixture({ ...input, runProcess }),
        runNegativeFixture: async () => ok({ observedToolOrActionKinds: [] }),
        now: () => "2026-01-01T00:00:00.000Z",
      },
    );

    expect(calls).toHaveLength(1);
    expect(result).toEqual({
      status: "unsupported",
      field: "terminal-parser",
      reason:
        provider === "codex-cli"
          ? "Codex compatibility profile grants filesystem read authority"
          : "Copilot compatibility profile grants filesystem read authority",
    });
    const observedArgv = calls[0]?.argv;
    expect(observedArgv).toBeDefined();
    if (!observedArgv) return;
    if (provider === "codex-cli") {
      const schemaIndex = observedArgv.indexOf("--output-schema");
      const resultIndex = observedArgv.indexOf("--output-last-message");
      expect(observedArgv).toEqual(
        buildCodexCliExecArgv({
          reviewSchemaPath: observedArgv[schemaIndex + 1] ?? "",
          resultPath: observedArgv[resultIndex + 1] ?? "",
          modelId,
        }),
      );
      return;
    }
    expect(observedArgv).toEqual(buildCopilotCliExecArgv({ modelId }));
  });
});
