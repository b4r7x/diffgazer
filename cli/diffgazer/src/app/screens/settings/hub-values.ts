import type { InitResponse, SettingsConfig } from "@diffgazer/core/schemas/config";
import type { SettingsAction } from "@diffgazer/core/schemas/presentation";

export function buildHubValues(
  init: InitResponse | undefined,
  settings: SettingsConfig | undefined,
): Record<SettingsAction, string> {
  const isTrusted = Boolean(init?.project.trust?.capabilities.readFiles);
  const provider = init?.config?.provider;
  const isConfigured = init?.setup?.isConfigured ?? false;
  const providerLabel = isConfigured && provider ? provider.toUpperCase() : "Not configured";
  const themeLabel = (settings?.theme ?? "auto").toUpperCase();
  const storageLabel = settings?.secretsStorage ? settings.secretsStorage.toUpperCase() : "Not set";
  const execution = settings?.agentExecution ?? "sequential";
  const executionLabel = execution === "parallel" ? "Parallel" : "Sequential";
  const lensCount = settings?.defaultLenses?.length ?? 0;
  const analysisLabel = lensCount > 0 ? `${lensCount} agents` : "Default";

  return {
    trust: isTrusted ? "Trusted" : "Not trusted",
    theme: themeLabel,
    provider: providerLabel,
    storage: storageLabel,
    "agent-execution": executionLabel,
    analysis: analysisLabel,
    diagnostics: "Local",
  };
}
