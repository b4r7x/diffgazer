import { pluralize } from "../../strings.js";
import type { SettingsAction } from "../presentation/navigation.js";
import type { AIProvider } from "./providers.js";
import type { AgentExecution, SecretsStorage, Theme } from "./settings.js";

export interface SettingsHubInput {
  provider: AIProvider | null | undefined;
  isConfigured: boolean;
  isTrusted: boolean;
  theme: Theme | null | undefined;
  secretsStorage: SecretsStorage | null | undefined;
  agentExecution: AgentExecution | null | undefined;
  selectedLensCount: number | null | undefined;
}

function getAgentExecutionLabel(mode: AgentExecution | null | undefined): string {
  if (mode === "parallel") return "Parallel";
  return "Sequential";
}

export function buildHubValues({
  provider,
  isConfigured,
  isTrusted,
  theme,
  secretsStorage,
  agentExecution,
  selectedLensCount,
}: SettingsHubInput): Record<SettingsAction, string> {
  const providerLabel = isConfigured && provider ? provider.toUpperCase() : "Not configured";
  const themeLabel = (theme ?? "auto").toUpperCase();
  const storageLabel = secretsStorage ? secretsStorage.toUpperCase() : "Not set";
  const analysisLabel =
    selectedLensCount && selectedLensCount > 0
      ? pluralize(selectedLensCount, "lens", "lenses")
      : "Default";

  return {
    trust: isTrusted ? "Trusted" : "Not trusted",
    theme: themeLabel,
    provider: providerLabel,
    storage: storageLabel,
    "agent-execution": getAgentExecutionLabel(agentExecution),
    analysis: analysisLabel,
    diagnostics: "Local",
  };
}
