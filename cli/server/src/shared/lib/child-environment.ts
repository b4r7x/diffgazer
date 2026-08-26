import { homedir } from "node:os";
import { err, ok, type Result } from "@diffgazer/core/result";

const CLI_CREDENTIAL_ENV_KEYS = [
  "COPILOT_GITHUB_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "CODEX_API_KEY",
  "API_KEY",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_KEY",
] as const;

const CLI_CHILD_ENV_ALLOWLIST = [
  "PATH",
  "HOME",
  "USER",
  "USERNAME",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LC_MESSAGES",
  "TERM",
  "TMPDIR",
  "TEMP",
  "TMP",
  "APPDATA",
  "LOCALAPPDATA",
  "USERPROFILE",
  "SystemRoot",
  "SYSTEMROOT",
  "ComSpec",
  "COMSPEC",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "XDG_RUNTIME_DIR",
] as const;

const FORBIDDEN_ENV_KEY_PATTERN =
  /(?:^|_)(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH(?:ORIZATION)?|COOKIE|BEARER)(?:$|_)/i;

type CliEnvironmentViolationCode =
  | "credential-env-key"
  | "forbidden-env-pattern"
  | "temporary-home"
  | "disallowed-env-key";

export type CliEnvironmentViolation = Readonly<{
  code: CliEnvironmentViolationCode;
  key: string;
}>;

function resolveAmbientHome(): string {
  return process.env.HOME ?? homedir();
}

function findCliEnvironmentViolations(
  env: Readonly<Record<string, string | undefined>>,
  options: Readonly<{ ambientHome?: string }> = {},
): readonly CliEnvironmentViolation[] {
  const ambientHome = options.ambientHome ?? resolveAmbientHome();
  const violations: CliEnvironmentViolation[] = [];

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      continue;
    }

    const normalizedKey = key.toUpperCase();
    if ((CLI_CREDENTIAL_ENV_KEYS as readonly string[]).includes(normalizedKey)) {
      violations.push({ code: "credential-env-key", key });
      continue;
    }

    if (FORBIDDEN_ENV_KEY_PATTERN.test(normalizedKey)) {
      violations.push({ code: "forbidden-env-pattern", key });
      continue;
    }

    if (normalizedKey === "HOME" && value !== ambientHome) {
      violations.push({ code: "temporary-home", key });
      continue;
    }

    if (!(CLI_CHILD_ENV_ALLOWLIST as readonly string[]).includes(key)) {
      violations.push({ code: "disallowed-env-key", key });
    }
  }

  return violations;
}

function validateCliChildEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  options: Readonly<{ ambientHome?: string }> = {},
): Result<Record<string, string>, CliEnvironmentViolation> {
  const violations = findCliEnvironmentViolations(env, options);
  const firstViolation = violations[0];
  if (firstViolation) {
    return err(firstViolation);
  }

  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return ok(output);
}

export function buildCliChildEnvironment(
  ambientEnv: Readonly<Record<string, string | undefined>> = process.env,
  options: Readonly<{ ambientHome?: string }> = {},
): Result<Record<string, string>, CliEnvironmentViolation> {
  const ambientHome = options.ambientHome ?? resolveAmbientHome();
  const narrowed: Record<string, string | undefined> = {};

  for (const key of CLI_CHILD_ENV_ALLOWLIST) {
    const value = ambientEnv[key];
    if (value !== undefined) {
      narrowed[key] = value;
    }
  }

  narrowed.HOME = ambientHome;
  return validateCliChildEnvironment(narrowed, { ambientHome });
}
