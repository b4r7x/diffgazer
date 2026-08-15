import type { ClientConfigurationSummary } from "../schemas/config/index.js";

function noticeFingerprint(notices: ClientConfigurationSummary["notices"]) {
  return notices.map((notice) => [notice.id, notice.noticeVersion]);
}

function configurationFingerprintInput(configuration: ClientConfigurationSummary) {
  const base = {
    configurationId: configuration.configurationId,
    revision: configuration.revision,
    status: configuration.status,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    selectedModelId: configuration.selectedModelId,
    notices: noticeFingerprint(configuration.notices),
    availableActions: configuration.availableActions,
  };

  if (configuration.transportFamily === "hosted-api") {
    return {
      ...base,
      endpoint: configuration.endpoint,
      region: configuration.region ?? null,
      workspace: configuration.workspace ?? null,
    };
  }

  if (configuration.transportFamily === "local-http") {
    return {
      ...base,
      endpoint: configuration.endpoint,
      authentication: configuration.authentication,
      presetId: configuration.presetId ?? null,
    };
  }

  return {
    ...base,
    installationId: configuration.installationId,
  };
}

export function configurationFingerprint(configuration: ClientConfigurationSummary): string {
  return JSON.stringify(configurationFingerprintInput(configuration));
}
