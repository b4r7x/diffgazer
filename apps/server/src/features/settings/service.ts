import type { SettingsConfig } from "../../shared/lib/config-store.js";
import { fetchSettings, persistSettings } from "./repo.js";

export const getSettings = (): SettingsConfig => fetchSettings();

export const saveSettings = (patch: Partial<SettingsConfig>): SettingsConfig => persistSettings(patch);
