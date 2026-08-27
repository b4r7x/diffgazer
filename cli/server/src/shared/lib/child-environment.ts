import { homedir } from "node:os";

export const CLI_CREDENTIAL_ENV_KEYS = [
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

export const CLI_CHILD_ENV_ALLOWLIST = [
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

export const FORBIDDEN_ENV_KEY_PATTERN =
  /(?:^|_)(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH(?:ORIZATION)?|COOKIE|BEARER)(?:$|_)/i;

export function buildCliChildEnvironment(
  ambientEnv: Readonly<Record<string, string | undefined>> = process.env,
  options: Readonly<{ ambientHome?: string }> = {},
): Record<string, string> {
  const narrowed: Record<string, string> = {};

  for (const key of CLI_CHILD_ENV_ALLOWLIST) {
    const value = ambientEnv[key];
    if (value !== undefined) {
      narrowed[key] = value;
    }
  }

  narrowed.HOME = options.ambientHome ?? process.env.HOME ?? homedir();
  return narrowed;
}
