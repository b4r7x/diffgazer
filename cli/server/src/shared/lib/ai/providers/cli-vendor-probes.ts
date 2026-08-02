import { err, ok, type Result } from "@diffgazer/core/result";
import type { LocalCliProductId } from "@diffgazer/core/schemas/config";
import { type CliCompatibilityRecord, runCliArgvProcess } from "./cli-compatibility.js";

/** Version string plus the argv and raw transcript that produced it. */
export type CliVersionAcquisition = Readonly<{
  value: string;
  acquisitionArgv: readonly string[];
  rawOutput: string;
}>;

export type CliAuthProbe = Readonly<{
  authStoreEvidence: CliCompatibilityRecord["auth"]["authStoreEvidence"];
}>;

export type CliModelPolicyProbe = Readonly<{
  accepted: boolean;
  rawOutput: string;
}>;

export type CliProbeInput = Readonly<{
  executable: string;
  cwd: string;
  env: Readonly<Record<string, string>>;
}>;

const AUTH_STATUS_ARGV: Record<LocalCliProductId, readonly string[]> = {
  "codex-cli": ["login", "status"],
  "copilot-cli": ["auth", "status"],
};

const MODEL_LISTING_ARGV: Record<LocalCliProductId, readonly string[]> = {
  "codex-cli": ["debug", "models"],
  "copilot-cli": ["model", "list"],
};

function transcript(result: { stdout: string; stderr: string }): string {
  return `${result.stdout}\n${result.stderr}`;
}

export async function acquireCliVersion(
  provider: LocalCliProductId,
  input: CliProbeInput,
): Promise<Result<CliVersionAcquisition, string>> {
  const result = await runCliArgvProcess({
    executable: input.executable,
    argv: ["--version"],
    cwd: input.cwd,
    env: input.env,
  });
  const rawOutput = transcript(result).trim();
  if (result.exitCode !== 0 || result.timedOut || rawOutput.length === 0) {
    return err(`Version acquisition failed for ${provider}`);
  }
  return ok({
    value: rawOutput.split("\n")[0]?.trim() ?? rawOutput,
    acquisitionArgv: [input.executable, "--version"],
    rawOutput,
  });
}

/**
 * Sign-in evidence from the vendor's own auth-status subcommand. A runnable
 * binary is not authorization: anything short of a positive status fails closed
 * to `"unavailable"` (REQ-070).
 */
export async function probeCliAuthStore(
  provider: LocalCliProductId,
  input: CliProbeInput,
): Promise<Result<CliAuthProbe, string>> {
  const result = await runCliArgvProcess({
    executable: input.executable,
    argv: [...AUTH_STATUS_ARGV[provider]],
    cwd: input.cwd,
    env: input.env,
  });
  const output = transcript(result).toLowerCase();

  if (output.includes("plaintext") || output.includes("fallback")) {
    return ok({ authStoreEvidence: "plaintext-fallback" });
  }
  if (result.exitCode !== 0 || result.timedOut || output.includes("not logged in")) {
    return ok({ authStoreEvidence: "unavailable" });
  }
  if (!output.includes("logged in") && !output.includes("authenticated")) {
    return ok({ authStoreEvidence: "unavailable" });
  }
  return ok({
    authStoreEvidence:
      provider === "codex-cli" ? "vendor-managed-user-owned" : "secure-store-reachable",
  });
}

/**
 * Model acceptance requires the exact model id as a listed token from the
 * vendor's model listing. Substring matches against help text are not evidence
 * (REQ-091).
 */
export async function probeCliModelPolicy(
  provider: LocalCliProductId,
  input: CliProbeInput & Readonly<{ modelId: string }>,
): Promise<Result<CliModelPolicyProbe, string>> {
  const result = await runCliArgvProcess({
    executable: input.executable,
    argv: [...MODEL_LISTING_ARGV[provider]],
    cwd: input.cwd,
    env: input.env,
  });
  const rawOutput = transcript(result);
  if (result.exitCode !== 0 || result.timedOut) {
    return ok({ accepted: false, rawOutput });
  }
  const listedTokens = new Set(rawOutput.split(/[\s,]+/).filter(Boolean));
  return ok({ accepted: listedTokens.has(input.modelId), rawOutput });
}
