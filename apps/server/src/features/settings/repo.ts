import type { SettingsConfig } from "../../shared/lib/config-store.js";
import { getSettings, updateSettings } from "../../shared/lib/config-store.js";

export const fetchSettings = (): SettingsConfig => getSettings();

export const persistSettings = (patch: Partial<SettingsConfig>): SettingsConfig => updateSettings(patch);
