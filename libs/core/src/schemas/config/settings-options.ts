import { isMember } from "../fields.js";
import type { SettingsAction } from "../presentation/navigation.js";
import {
  AGENT_EXECUTION_MODES,
  type AgentExecution,
  SECRETS_STORAGE,
  type SecretsStorage,
  THEMES,
  type Theme,
} from "./settings.js";

export interface SettingsOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

export type SelectableTheme = Exclude<Theme, "terminal">;
export type ResolvedSelectableTheme = Exclude<SelectableTheme, "auto">;

export const SELECTABLE_THEME_OPTIONS = [
  { value: "auto", label: "Auto", description: "Follow system preference" },
  { value: "dark", label: "Dark", description: "Dark background with light text" },
  { value: "light", label: "Light", description: "Light background with dark text" },
] as const satisfies ReadonlyArray<SettingsOption<SelectableTheme>>;

export const SECRETS_STORAGE_OPTIONS = [
  {
    value: "file",
    label: "File Storage (Local)",
    description:
      "Store secrets in a local file with OS file permissions (mode 0600). Simple and portable. For stronger protection, consider the system keyring.",
  },
  {
    value: "keyring",
    label: "System Keyring",
    description: "Use your operating system's secure keychain. Better security, system-integrated.",
  },
] as const satisfies ReadonlyArray<SettingsOption<SecretsStorage>>;

export const AGENT_EXECUTION_OPTIONS = [
  {
    value: "sequential",
    label: "Sequential",
    description: "Agents run one after another. Works with all providers and tiers.",
  },
  {
    value: "parallel",
    label: "Parallel",
    description: "All agents run at once. Faster, but may hit rate limits on free tiers.",
  },
] as const satisfies ReadonlyArray<SettingsOption<AgentExecution>>;

/** Header copy the web app and the TUI mirror verbatim; analysis is described by its lenses, not its agents. */
export const SETTINGS_SCREEN_COPY = {
  theme: {
    title: "Theme Settings",
    subtitle: "Choose how Diffgazer appears.",
  },
  storage: {
    title: "Secrets Storage",
    subtitle: "Choose where API keys and sensitive data should be stored.",
  },
  "agent-execution": {
    title: "Agent Execution Mode",
    subtitle: "Choose whether analysis agents run in sequence or in parallel.",
  },
  analysis: {
    title: "Analysis Settings",
    subtitle: "Choose which lenses run during reviews.",
  },
} as const satisfies Partial<Record<SettingsAction, { title: string; subtitle: string }>>;

export function isTheme(value: string | null): value is Theme {
  return isMember(THEMES, value);
}

export function isSelectableTheme(value: string | null): value is SelectableTheme {
  return value !== "terminal" && isTheme(value);
}

export function toSelectableTheme(value: Theme): SelectableTheme {
  if (value === "terminal") return "auto";
  return value;
}

export function resolveSelectableTheme(
  theme: SelectableTheme,
  systemTheme: ResolvedSelectableTheme,
): ResolvedSelectableTheme {
  return theme === "auto" ? systemTheme : theme;
}

export function isSecretsStorage(value: string | null): value is SecretsStorage {
  return isMember(SECRETS_STORAGE, value);
}

export function isAgentExecution(value: string | null): value is AgentExecution {
  return isMember(AGENT_EXECUTION_MODES, value);
}
