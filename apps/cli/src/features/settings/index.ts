export { settingsApi } from "./api/index.js";
export { useSettingsState } from "./hooks/index.js";
export type { SettingsState, UseSettingsStateResult } from "./hooks/use-settings-state.js";

export type {
  SettingsConfig,
  TrustConfig,
  TrustCapabilities,
  TrustMode,
  Theme,
  ControlsMode,
} from "@repo/schemas/settings";

export type {
  AIProvider,
  ProviderStatus,
  ConfigCheckResponse,
  CurrentConfigResponse,
  ProvidersStatusResponse,
  ProviderInfo,
  ModelInfo,
} from "@repo/schemas/config";
