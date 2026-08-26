import type { ClientConfigurationSummary } from "../schemas/config/index.js";

function noticeFingerprint(notices: ClientConfigurationSummary["notices"]) {
  return notices.map((notice) => [notice.id, notice.noticeVersion]);
}

function configurationFingerprintInput(configuration: ClientConfigurationSummary) {
  return {
    configurationId: configuration.configurationId,
    revision: configuration.revision,
    status: configuration.status,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    selectedModelId: configuration.selectedModelId,
    notices: noticeFingerprint(configuration.notices),
    availableActions: configuration.availableActions,
    endpoint: configuration.endpoint,
  };
}

export function configurationFingerprint(configuration: ClientConfigurationSummary): string {
  return JSON.stringify(configurationFingerprintInput(configuration));
}
