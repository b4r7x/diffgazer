import { createHash } from "node:crypto";
import { access, constants, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, release, tmpdir } from "node:os";
import path from "node:path";
import { getErrorMessage } from "@diffgazer/core/errors";
import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  acquireCliVersion,
  type CliAuthProbe,
  type CliModelPolicyProbe,
  type CliVersionAcquisition,
  probeCliAuthStore,
  probeCliModelPolicy,
} from "../cli-vendor-probes.js";
import { buildCliChildEnvironment } from "./child-environment.js";
import { createDisposableFixtureCheckout, runNegativeFixtureHarness } from "./probe-fixture.js";
import {
  type CliCompatibilityProbeProvider,
  type CliPositiveFixtureRun,
  defaultRunNegativeFixture,
  defaultRunPositiveFixture,
} from "./probe-observation.js";
import {
  type CliCompatibilityRecord,
  digestExecutableRealPath,
  hashExecutableFileSha256,
  parseCliCompatibilityRecord,
  redactCliArgv,
  redactCliCompatibilityRecord,
  validateCliCompatibilityEvidence,
} from "./record.js";
import { buildReviewSchemaJson, hashReviewSchemaJson } from "./review-schema.js";

const CLI_COMPATIBILITY_PROBE_OPT_IN_ENV = "DIFFGAZER_LIVE_PROBES" as const;

type CliCompatibilityUnsupportedField =
  | "executable"
  | "version"
  | "auth"
  | "model-policy"
  | "positive-fixture"
  | "negative-fixture"
  | "terminal-parser"
  | "network-opt-in";

export type CliCompatibilityProbeResult =
  | Readonly<{ status: "supported"; record: CliCompatibilityRecord }>
  | Readonly<{
      status: "positive-passed";
      provider: CliCompatibilityProbeProvider;
      version: string;
    }>
  | Readonly<{
      status: "unsupported";
      reason: string;
      field: CliCompatibilityUnsupportedField;
    }>
  | Readonly<{ status: "skipped"; reason: string }>;

export type CliCompatibilityProbeInput = Readonly<{
  provider: CliCompatibilityProbeProvider;
  modelId: string;
  executable?: string;
  liveOptIn?: boolean;
  /**
   * `"positive-only"` stops after the one live structured generation the
   * user-facing readiness test needs. `"full"` also runs the hostile negative
   * fixture — a second live generation — and assembles the strict bundled
   * record, which only the build-time probe consumes.
   */
  fixtures?: "full" | "positive-only";
  /** Aborts every vendor CLI the probe spawns, so a lost wall-time race leaves no child running. */
  signal?: AbortSignal;
}>;

export type CliCompatibilityProbeDependencies = Readonly<{
  resolveExecutable?: (provider: CliCompatibilityProbeProvider) => Promise<Result<string, string>>;
  acquireVersion?: (input: {
    provider: CliCompatibilityProbeProvider;
    executable: string;
    cwd: string;
    env: Readonly<Record<string, string>>;
    signal?: AbortSignal;
  }) => Promise<Result<CliVersionAcquisition, string>>;
  probeAuth?: (input: {
    provider: CliCompatibilityProbeProvider;
    executable: string;
    cwd: string;
    env: Readonly<Record<string, string>>;
    signal?: AbortSignal;
  }) => Promise<Result<CliAuthProbe, string>>;
  probeModelPolicy?: (input: {
    provider: CliCompatibilityProbeProvider;
    executable: string;
    modelId: string;
    cwd: string;
    env: Readonly<Record<string, string>>;
    signal?: AbortSignal;
  }) => Promise<Result<CliModelPolicyProbe, string>>;
  runPositiveFixture?: (input: {
    provider: CliCompatibilityProbeProvider;
    executable: string;
    modelId: string;
    fixtureRoot: string;
    env: Readonly<Record<string, string>>;
    reviewSchemaPath: string;
    resultPath: string;
    signal?: AbortSignal;
  }) => Promise<Result<CliPositiveFixtureRun, string>>;
  runNegativeFixture?: (input: {
    provider: CliCompatibilityProbeProvider;
    executable: string;
    modelId: string;
    fixtureRoot: string;
    env: Readonly<Record<string, string>>;
    loopbackUrl: string;
    hostilePrompt: string;
    outOfFixtureCanary: Readonly<{ path: string; value: string }>;
    signal?: AbortSignal;
  }) => Promise<Result<Readonly<{ observedToolOrActionKinds: readonly string[] }>, string>>;
  now?: () => string;
}>;

const PROVIDER_EXECUTABLE_NAMES: Record<CliCompatibilityProbeProvider, string> = {
  "codex-cli": "codex",
  "copilot-cli": "copilot",
};

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isCliCompatibilityLiveProbeOptIn(): boolean {
  return process.env[CLI_COMPATIBILITY_PROBE_OPT_IN_ENV] === "1";
}

function digestOsRelease(): string {
  return sha256CanonicalJsonSync(release());
}

function unsupported(
  field: CliCompatibilityUnsupportedField,
  reason: string,
): CliCompatibilityProbeResult {
  return { status: "unsupported", field, reason };
}

const WINDOWS_DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/**
 * Windows vendor binaries are `codex.exe`/`copilot.cmd`, never the bare name, so a
 * PATHEXT-free search can never resolve on the two intended win32 platforms.
 */
function executableCandidateNames(command: string): readonly string[] {
  if (process.platform !== "win32") return [command];
  const extensions = (process.env.PATHEXT ?? WINDOWS_DEFAULT_PATHEXT)
    .split(";")
    .map((extension) => extension.trim())
    .filter((extension) => extension.length > 0);
  return [...extensions.map((extension) => `${command}${extension}`), command];
}

/** Default `resolveExecutable` dependency: first PATH entry that is executable. */
export async function defaultResolveExecutable(
  provider: CliCompatibilityProbeProvider,
): Promise<Result<string, string>> {
  const command = PROVIDER_EXECUTABLE_NAMES[provider];
  const pathValue = process.env.PATH;
  if (!pathValue) {
    return err(`PATH is unavailable while resolving ${provider}`);
  }

  const directories = pathValue.split(path.delimiter);
  const candidateNames = executableCandidateNames(command);
  for (const directory of directories) {
    for (const name of candidateNames) {
      const candidate = path.join(directory, name);
      try {
        await access(candidate, constants.X_OK);
        return ok(candidate);
      } catch {
        // Continue searching PATH.
      }
    }
  }

  return err(`Executable not found for ${provider}`);
}

// Each mode stops at one terminal shape: full mode always continues to the
// strict record, positive-only always returns before it is assembled, so
// neither caller has to write a branch it can never reach.
export async function runCliCompatibilityProbe(
  input: CliCompatibilityProbeInput & { readonly fixtures?: "full" },
  dependencies?: CliCompatibilityProbeDependencies,
): Promise<Exclude<CliCompatibilityProbeResult, { status: "positive-passed" }>>;
export async function runCliCompatibilityProbe(
  input: CliCompatibilityProbeInput & { readonly fixtures: "positive-only" },
  dependencies?: CliCompatibilityProbeDependencies,
): Promise<Exclude<CliCompatibilityProbeResult, { status: "supported" }>>;
export async function runCliCompatibilityProbe(
  input: CliCompatibilityProbeInput,
  dependencies: CliCompatibilityProbeDependencies = {},
): Promise<CliCompatibilityProbeResult> {
  const usingInjectedDependencies =
    dependencies.resolveExecutable !== undefined ||
    dependencies.acquireVersion !== undefined ||
    dependencies.probeAuth !== undefined ||
    dependencies.probeModelPolicy !== undefined ||
    dependencies.runPositiveFixture !== undefined ||
    dependencies.runNegativeFixture !== undefined;

  if (!usingInjectedDependencies && !input.liveOptIn && !isCliCompatibilityLiveProbeOptIn()) {
    return { status: "skipped", reason: "live-probes-disabled" };
  }

  const resolveExecutable = dependencies.resolveExecutable ?? defaultResolveExecutable;
  const acquireVersion =
    dependencies.acquireVersion ?? ((input) => acquireCliVersion(input.provider, input));
  const probeAuth = dependencies.probeAuth ?? ((input) => probeCliAuthStore(input.provider, input));
  const probeModelPolicy =
    dependencies.probeModelPolicy ?? ((input) => probeCliModelPolicy(input.provider, input));
  const runPositiveFixture = dependencies.runPositiveFixture ?? defaultRunPositiveFixture;
  const runNegativeFixture = dependencies.runNegativeFixture ?? defaultRunNegativeFixture;
  const now = dependencies.now ?? (() => new Date().toISOString());

  const executableResult = input.executable
    ? ok(input.executable)
    : await resolveExecutable(input.provider);
  if (!executableResult.ok) {
    return unsupported("executable", executableResult.error);
  }
  const executable = executableResult.value;

  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "cli-compat-fixture-"));
  const reviewSchemaPath = path.join(fixtureRoot, "review-schema.json");
  const resultPath = path.join(fixtureRoot, "result.json");

  try {
    await createDisposableFixtureCheckout(fixtureRoot);
    const reviewSchemaJson = buildReviewSchemaJson();
    await writeFile(reviewSchemaPath, `${JSON.stringify(reviewSchemaJson)}\n`, "utf8");
    const reviewSchemaSha256 = hashReviewSchemaJson(reviewSchemaJson);

    const ambientHome = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
    const envResult = buildCliChildEnvironment(process.env, { ambientHome });
    if (!envResult.ok) {
      return unsupported("auth", `Child environment rejected: ${envResult.error.code}`);
    }

    const versionResult = await acquireVersion({
      provider: input.provider,
      executable,
      cwd: fixtureRoot,
      env: envResult.value,
      signal: input.signal,
    });
    if (!versionResult.ok) {
      return unsupported("version", versionResult.error);
    }

    const authResult = await probeAuth({
      provider: input.provider,
      executable,
      cwd: fixtureRoot,
      env: envResult.value,
      signal: input.signal,
    });
    if (!authResult.ok) {
      return unsupported("auth", authResult.error);
    }
    if (authResult.value.authStoreEvidence === "unavailable") {
      return unsupported("auth", "Ambient vendor auth is unavailable");
    }
    if (authResult.value.authStoreEvidence === "plaintext-fallback") {
      return unsupported("auth", "Plaintext auth-store fallback is unsupported");
    }

    const modelPolicyResult = await probeModelPolicy({
      provider: input.provider,
      executable,
      modelId: input.modelId,
      cwd: fixtureRoot,
      env: envResult.value,
      signal: input.signal,
    });
    if (!modelPolicyResult.ok) {
      return unsupported("model-policy", modelPolicyResult.error);
    }
    if (!modelPolicyResult.value.accepted) {
      return unsupported("model-policy", `Model ${input.modelId} was rejected by policy check`);
    }

    const positiveResult = await runPositiveFixture({
      provider: input.provider,
      executable,
      modelId: input.modelId,
      fixtureRoot,
      env: envResult.value,
      reviewSchemaPath,
      resultPath,
      signal: input.signal,
    });
    if (!positiveResult.ok) {
      return unsupported("positive-fixture", positiveResult.error);
    }
    if (positiveResult.value.exitCode !== 0) {
      return unsupported("positive-fixture", "Positive fixture did not exit zero");
    }

    if (input.fixtures === "positive-only") {
      return {
        status: "positive-passed",
        provider: input.provider,
        version: versionResult.value.value,
      };
    }

    let negativeHarness: Awaited<ReturnType<typeof runNegativeFixtureHarness>>;
    try {
      negativeHarness = await runNegativeFixtureHarness({
        fixtureRoot,
        run: async (hostilePrompt, loopbackUrl, outOfFixtureCanary) => {
          const negativeResult = await runNegativeFixture({
            provider: input.provider,
            executable,
            modelId: input.modelId,
            fixtureRoot,
            env: envResult.value,
            loopbackUrl,
            hostilePrompt,
            outOfFixtureCanary,
            signal: input.signal,
          });
          if (!negativeResult.ok) {
            throw new Error(negativeResult.error);
          }
          return negativeResult.value;
        },
      });
    } catch (error) {
      return unsupported("negative-fixture", getErrorMessage(error));
    }
    if (!negativeHarness.ok) {
      return unsupported(negativeHarness.error.field, negativeHarness.error.reason);
    }

    const [realPathDigest, fileSha256] = await Promise.all([
      digestExecutableRealPath(executable),
      hashExecutableFileSha256(executable),
    ]);

    const terminalSource =
      input.provider === "codex-cli" ? "codex-output-last-message" : "copilot-jsonl";

    const record: CliCompatibilityRecord = {
      schemaVersion: 1,
      provider: input.provider,
      observedAt: now(),
      platform: {
        nodePlatform: process.platform,
        architecture: process.arch,
        osReleaseDigest: digestOsRelease(),
      },
      executable: {
        realPathDigest,
        fileSha256,
        version: {
          value: versionResult.value.value,
          acquisitionArgv: [...versionResult.value.acquisitionArgv],
          rawOutputSha256: sha256Text(versionResult.value.rawOutput),
        },
      },
      auth: {
        mode: "vendor-managed-local-auth",
        credentialPassedByDiffgazer: false,
        authStoreEvidence: authResult.value.authStoreEvidence,
      },
      model: {
        requested: input.modelId,
        policyCheck: "accepted",
        rawOutputSha256: sha256Text(modelPolicyResult.value.rawOutput),
      },
      profile: {
        argv: [...redactCliArgv(positiveResult.value.argv)],
        acceptedFlags: [...positiveResult.value.acceptedFlags],
        workingDirectoryKind: "neutral-disposable-fixture",
      },
      positiveFixture: {
        exitCode: 0,
        stdoutJsonlSha256: sha256Text(positiveResult.value.stdoutJsonl),
        reviewSchemaSha256,
        terminal: {
          source: terminalSource,
          acceptedEventKinds: [...positiveResult.value.acceptedEventKinds],
          acceptedFieldPaths: [...positiveResult.value.acceptedFieldPaths],
          resultTextFieldPath: positiveResult.value.resultTextFieldPath,
          parserResult: "accepted",
        },
      },
      negativeFixture: {
        ...negativeHarness.value,
        attemptIds: [...negativeHarness.value.attemptIds],
        observedToolOrActionKinds: [...negativeHarness.value.observedToolOrActionKinds],
      },
    };

    const parsed = parseCliCompatibilityRecord(record);
    if (!parsed.ok) {
      return unsupported("terminal-parser", parsed.error.message);
    }
    const evidence = validateCliCompatibilityEvidence(parsed.value);
    if (!evidence.ok) {
      return unsupported("terminal-parser", evidence.error.message);
    }

    return { status: "supported", record: redactCliCompatibilityRecord(evidence.value) };
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}
