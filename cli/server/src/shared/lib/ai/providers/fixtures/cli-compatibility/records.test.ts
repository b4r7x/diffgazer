import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CLI_COMPATIBILITY_PROVIDERS,
  type CliCompatibilityRecord,
  type CliCompatibilityTuple,
  HOSTILE_ATTEMPT_IDS,
  matchCliCompatibilityTuple,
  parseCliCompatibilityRecord,
  validateCliCompatibilityEvidence,
} from "../../cli-compatibility.js";

const CLI_COMPATIBILITY_GENERATOR_MARKER = "cli-compatibility-probe" as const;
const CLI_COMPATIBILITY_BUNDLE_SCHEMA_VERSION = 1 as const;

const CLI_PROBE_MODELS = {
  "codex-cli": "gpt-4.1",
  "copilot-cli": "gpt-5",
} as const satisfies Record<(typeof CLI_COMPATIBILITY_PROVIDERS)[number], string>;

const CLI_INTENDED_PLATFORMS = [
  { nodePlatform: "darwin", architecture: "arm64" },
  { nodePlatform: "darwin", architecture: "x64" },
  { nodePlatform: "linux", architecture: "arm64" },
  { nodePlatform: "linux", architecture: "x64" },
  { nodePlatform: "win32", architecture: "arm64" },
  { nodePlatform: "win32", architecture: "x64" },
] as const;

type CliIntendedPlatform = (typeof CLI_INTENDED_PLATFORMS)[number];

type CliIntendedCompatibilityTuple = Readonly<{
  provider: (typeof CLI_COMPATIBILITY_PROVIDERS)[number];
  modelId: string;
  platform: CliIntendedPlatform;
}>;

const CLI_INTENDED_COMPATIBILITY_TUPLES: readonly CliIntendedCompatibilityTuple[] =
  CLI_COMPATIBILITY_PROVIDERS.flatMap((provider) =>
    CLI_INTENDED_PLATFORMS.map((platform) => ({
      provider,
      modelId: CLI_PROBE_MODELS[provider],
      platform,
    })),
  );

const CODEX_VERIFIED_FLAGS = [
  "--ephemeral",
  "--sandbox",
  "read-only",
  "--ignore-user-config",
  "--ignore-rules",
  "--json",
  "--output-schema",
  "--output-last-message",
  "--model",
] as const;

const COPILOT_VERIFIED_FLAGS = [
  "-p",
  "--output-format=json",
  "--stream=off",
  "--model",
  "--available-tools=view,glob,grep",
  "--disable-builtin-mcps",
  "--no-custom-instructions",
  "--no-ask-user",
  "--no-remote",
  "--no-remote-export",
] as const;

const CliCompatibilityRecordBundleSchema = z
  .strictObject({
    generator: z.literal(CLI_COMPATIBILITY_GENERATOR_MARKER),
    schemaVersion: z.literal(CLI_COMPATIBILITY_BUNDLE_SCHEMA_VERSION),
    records: z.array(z.unknown()),
  })
  .readonly();

const CliUnsupportedRecordSchema = z
  .strictObject({
    provider: z.enum(CLI_COMPATIBILITY_PROVIDERS),
    modelId: z.string().min(1),
    platform: z
      .strictObject({
        nodePlatform: z.string().min(1),
        architecture: z.string().min(1),
      })
      .readonly(),
    status: z.enum(["skipped", "unsupported"]),
    reason: z.string().min(1),
  })
  .readonly();

const CliUnsupportedRecordBundleSchema = z
  .strictObject({
    generator: z.literal(CLI_COMPATIBILITY_GENERATOR_MARKER),
    schemaVersion: z.literal(CLI_COMPATIBILITY_BUNDLE_SCHEMA_VERSION),
    records: z.array(CliUnsupportedRecordSchema),
  })
  .readonly();

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));

function loadJsonFixture(fileName: string): unknown {
  const raw = readFileSync(path.join(FIXTURE_DIR, fileName), "utf8");
  return JSON.parse(raw) as unknown;
}

function tupleKey(tuple: CliIntendedCompatibilityTuple): string {
  return `${tuple.provider}:${tuple.platform.nodePlatform}:${tuple.platform.architecture}`;
}

function loadCompatibilityRecordBundle() {
  const parsed = CliCompatibilityRecordBundleSchema.safeParse(
    loadJsonFixture("compatibility-records.json"),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const records: CliCompatibilityRecord[] = [];
  for (const entry of parsed.data.records) {
    const record = parseCliCompatibilityRecord(entry);
    if (!record.ok) {
      throw new Error(record.error.message);
    }
    records.push(record.value);
  }

  return {
    generator: parsed.data.generator,
    schemaVersion: parsed.data.schemaVersion,
    records,
  };
}

function loadUnsupportedRecordBundle() {
  const parsed = CliUnsupportedRecordBundleSchema.safeParse(
    loadJsonFixture("unsupported-records.json"),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}

function findSupportedRecord(
  tuple: CliIntendedCompatibilityTuple,
  records: readonly CliCompatibilityRecord[],
): CliCompatibilityRecord | undefined {
  return records.find(
    (record) =>
      record.provider === tuple.provider &&
      record.platform.nodePlatform === tuple.platform.nodePlatform &&
      record.platform.architecture === tuple.platform.architecture &&
      record.model.requested === tuple.modelId,
  );
}

function findUnsupportedRecord(
  tuple: CliIntendedCompatibilityTuple,
  records: ReturnType<typeof loadUnsupportedRecordBundle>["records"],
) {
  return records.find(
    (record) =>
      record.provider === tuple.provider &&
      record.platform.nodePlatform === tuple.platform.nodePlatform &&
      record.platform.architecture === tuple.platform.architecture &&
      record.modelId === tuple.modelId,
  );
}

function canProduceCliReadyEvidence(record: CliCompatibilityRecord | null | undefined): boolean {
  if (!record) return false;
  const parsed = parseCliCompatibilityRecord(record);
  if (!parsed.ok) return false;
  const evidence = validateCliCompatibilityEvidence(parsed.value);
  if (!evidence.ok) return false;
  const tuple: CliCompatibilityTuple = {
    provider: evidence.value.provider,
    platform: {
      nodePlatform: evidence.value.platform.nodePlatform,
      architecture: evidence.value.platform.architecture,
    },
    executable: {
      realPathDigest: evidence.value.executable.realPathDigest,
      fileSha256: evidence.value.executable.fileSha256,
      version: evidence.value.executable.version.value,
    },
    modelId: evidence.value.model.requested,
    reviewSchemaSha256: evidence.value.positiveFixture.reviewSchemaSha256,
  };
  return matchCliCompatibilityTuple(evidence.value, tuple).matched;
}

function assertVerifiedFlags(record: CliCompatibilityRecord): void {
  const expected =
    record.provider === "codex-cli" ? [...CODEX_VERIFIED_FLAGS] : [...COPILOT_VERIFIED_FLAGS];
  expect(record.profile.acceptedFlags).toEqual(expected);
}

function assertRuntimeProbedFields(record: CliCompatibilityRecord): void {
  expect(record.executable.version.value.length).toBeGreaterThan(0);
  expect(record.executable.version.acquisitionArgv.length).toBeGreaterThan(0);
  expect(record.executable.version.rawOutputSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(record.model.rawOutputSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(record.positiveFixture.stdoutJsonlSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(record.positiveFixture.reviewSchemaSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(record.positiveFixture.terminal.acceptedFieldPaths.length).toBeGreaterThan(0);
  expect(record.positiveFixture.terminal.resultTextFieldPath.length).toBeGreaterThan(0);
}

function assertHostileEvidence(record: CliCompatibilityRecord): void {
  expect(record.negativeFixture.attemptIds).toEqual([...HOSTILE_ATTEMPT_IDS]);
  expect(record.negativeFixture.beforeTreeSha256).toBe(record.negativeFixture.afterTreeSha256);
  expect(record.negativeFixture.treeUnchanged).toBe(true);
  expect(record.negativeFixture.localNetworkConnections).toBe(0);
  expect(record.negativeFixture.observedToolOrActionKinds).toEqual([]);
  expect(record.negativeFixture.passed).toBe(true);
}

function assertRedaction(record: CliCompatibilityRecord): void {
  const serialized = JSON.stringify(record);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
  expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/);
  expect(serialized).not.toMatch(/\/Users\/[^"]+/);
  expect(serialized).not.toMatch(/acct_[A-Za-z0-9]+/);
}

function assertSupportedRecord(record: CliCompatibilityRecord): void {
  expect(record.schemaVersion).toBe(1);
  expect(record.auth.credentialPassedByDiffgazer).toBe(false);
  expect(record.auth.mode).toBe("vendor-managed-local-auth");
  expect(record.model.policyCheck).toBe("accepted");
  expect(record.positiveFixture.exitCode).toBe(0);
  expect(record.positiveFixture.terminal.parserResult).toBe("accepted");
  expect(record.profile.workingDirectoryKind).toBe("neutral-disposable-fixture");

  if (record.provider === "codex-cli") {
    expect(record.auth.authStoreEvidence).toBe("vendor-managed-user-owned");
    expect(record.positiveFixture.terminal.source).toBe("codex-output-last-message");
  } else {
    expect(record.auth.authStoreEvidence).toBe("secure-store-reachable");
    expect(record.positiveFixture.terminal.source).toBe("copilot-jsonl");
  }

  const evidence = validateCliCompatibilityEvidence(record);
  expect(evidence.ok).toBe(true);

  assertVerifiedFlags(record);
  assertRuntimeProbedFields(record);
  assertHostileEvidence(record);
  assertRedaction(record);
  expect(canProduceCliReadyEvidence(record)).toBe(true);
}

describe("T-057 cli compatibility fixture bundles", () => {
  const supportedBundle = loadCompatibilityRecordBundle();
  const unsupportedBundle = loadUnsupportedRecordBundle();

  it("declares the generator marker and bundle schemaVersion=1", () => {
    expect(supportedBundle.generator).toBe(CLI_COMPATIBILITY_GENERATOR_MARKER);
    expect(supportedBundle.schemaVersion).toBe(CLI_COMPATIBILITY_BUNDLE_SCHEMA_VERSION);
    expect(unsupportedBundle.generator).toBe(CLI_COMPATIBILITY_GENERATOR_MARKER);
    expect(unsupportedBundle.schemaVersion).toBe(CLI_COMPATIBILITY_BUNDLE_SCHEMA_VERSION);
  });

  it("covers every intended provider/platform/architecture tuple exactly once", () => {
    const supportedKeys = new Set(
      supportedBundle.records.map(
        (record) =>
          `${record.provider}:${record.platform.nodePlatform}:${record.platform.architecture}`,
      ),
    );
    const unsupportedKeys = new Set(
      unsupportedBundle.records.map(
        (record) =>
          `${record.provider}:${record.platform.nodePlatform}:${record.platform.architecture}`,
      ),
    );

    for (const tuple of CLI_INTENDED_COMPATIBILITY_TUPLES) {
      const key = tupleKey(tuple);
      const hasSupported = supportedKeys.has(key);
      const hasUnsupported = unsupportedKeys.has(key);
      expect(hasSupported !== hasUnsupported).toBe(true);
    }

    expect(supportedKeys.size + unsupportedKeys.size).toBe(
      CLI_INTENDED_COMPATIBILITY_TUPLES.length,
    );
    expect(unsupportedBundle.records).toHaveLength(CLI_INTENDED_COMPATIBILITY_TUPLES.length);
  });

  it.each(
    CLI_INTENDED_COMPATIBILITY_TUPLES,
  )("$provider on $platform.nodePlatform/$platform.architecture is explicitly unsupported or evidenced", (tuple) => {
    const supported = findSupportedRecord(tuple, supportedBundle.records);
    const unsupported = findUnsupportedRecord(tuple, unsupportedBundle.records);

    if (supported) {
      expect(unsupported).toBeUndefined();
      assertSupportedRecord(supported);
      return;
    }

    expect(unsupported).toBeDefined();
    if (!unsupported) return;
    expect(["skipped", "unsupported"]).toContain(unsupported.status);
    expect(unsupported.reason.length).toBeGreaterThan(0);
    expect(canProduceCliReadyEvidence(null)).toBe(false);
    expect(canProduceCliReadyEvidence(supported)).toBe(false);
  });

  it("does not enable any tuple without a passing supported record", () => {
    for (const tuple of CLI_INTENDED_COMPATIBILITY_TUPLES) {
      const supported = findSupportedRecord(tuple, supportedBundle.records);
      expect(canProduceCliReadyEvidence(supported)).toBe(supported !== undefined);
    }
  });
});
