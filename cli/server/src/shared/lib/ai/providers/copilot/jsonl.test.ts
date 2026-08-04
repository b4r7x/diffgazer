import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCliCompatibilityRecord } from "../cli-compatibility/compat.js";
import { parseCopilotJsonlTerminal } from "./cli.js";
import { parseCopilotJsonlStream } from "./jsonl.js";

const SHA = "a".repeat(64);

const RECORD = parseCliCompatibilityRecord({
  schemaVersion: 1,
  provider: "copilot-cli",
  observedAt: "2026-01-01T00:00:00.000Z",
  platform: { nodePlatform: "darwin", architecture: "arm64", osReleaseDigest: SHA },
  executable: {
    realPathDigest: SHA,
    fileSha256: SHA,
    version: { value: "1.0.0", acquisitionArgv: ["copilot", "--version"], rawOutputSha256: SHA },
  },
  auth: {
    mode: "vendor-managed-local-auth",
    credentialPassedByDiffgazer: false,
    authStoreEvidence: "secure-store-reachable",
  },
  model: { requested: "gpt-5-mini", policyCheck: "accepted", rawOutputSha256: SHA },
  profile: {
    argv: ["copilot", "-p"],
    acceptedFlags: ["-p", "--model"],
    workingDirectoryKind: "neutral-disposable-fixture",
  },
  positiveFixture: {
    exitCode: 0,
    stdoutJsonlSha256: SHA,
    reviewSchemaSha256: SHA,
    terminal: {
      source: "copilot-jsonl",
      acceptedEventKinds: ["result"],
      acceptedFieldPaths: ["issues", "type"],
      resultTextFieldPath: "issues",
      parserResult: "accepted",
    },
  },
  negativeFixture: {
    attemptIds: [
      "create",
      "overwrite",
      "delete",
      "rename",
      "shell-created",
      "loopback-curl",
      "fixture-mcp-ping",
      "plugin",
      "hook",
      "subagent",
      "export",
      "repository-instruction",
    ],
    beforeTreeSha256: SHA,
    afterTreeSha256: SHA,
    treeUnchanged: true,
    localNetworkConnections: 0,
    observedToolOrActionKinds: [],
    passed: true,
  },
});

const STREAMS = [
  { id: "complete terminal record", stdout: '{"type":"result","issues":[]}\n', accepted: true },
  {
    id: "trailing malformed line",
    stdout: '{"type":"result","issues":[]}\nnot-json\n',
    accepted: false,
  },
  {
    id: "leading malformed line",
    stdout: 'not-json\n{"type":"result","issues":[]}\n',
    accepted: false,
  },
  { id: "single line without newline", stdout: '{"type":"result","issues":[]}', accepted: false },
  { id: "empty stream", stdout: "   \n", accepted: false },
  { id: "non-object line", stdout: "[1,2]\n", accepted: false },
] as const;

describe("Copilot JSONL terminal contract", () => {
  it.each(STREAMS)("$id is accepted=$accepted by the shared stream parser", ({
    stdout,
    accepted,
  }) => {
    expect(parseCopilotJsonlStream(stdout).ok).toBe(accepted);
  });

  it.each(STREAMS)("$id gets the same verdict from the runtime parser", ({ stdout, accepted }) => {
    expect(RECORD.ok).toBe(true);
    if (!RECORD.ok) return;
    expect(parseCopilotJsonlTerminal(stdout, RECORD.value).ok).toBe(accepted);
  });

  it("projects the terminal record from the last complete line", () => {
    const parsed = parseCopilotJsonlStream('{"type":"progress"}\n{"type":"result","issues":[]}\n');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.acceptedEventKinds).toEqual(["progress", "result"]);
    expect(parsed.value.acceptedFieldPaths).toEqual(["issues", "type"]);
    expect(parsed.value.resultTextFieldPath).toBe("issues");
  });

  it("is the single parser used by both the compatibility probe and the runtime adapter", async () => {
    const directory = path.dirname(fileURLToPath(import.meta.url));
    const [probeSource, runtimeSource] = await Promise.all([
      readFile(path.join(directory, "..", "cli-compatibility", "probe.ts"), "utf8"),
      readFile(path.join(directory, "cli.ts"), "utf8"),
    ]);

    for (const { source, specifier } of [
      { source: probeSource, specifier: "../copilot/jsonl.js" },
      { source: runtimeSource, specifier: "./jsonl.js" },
    ]) {
      expect(source).toContain(`from "${specifier}"`);
      expect(source).not.toContain("function extractCopilotTerminalFields");
    }
  });
});
