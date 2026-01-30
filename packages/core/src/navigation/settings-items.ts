import type { AppContext } from "./menu-items.js";

export type SettingsAction = "trust" | "theme" | "provider" | "diagnostics";

export interface SettingsMenuItem {
  id: SettingsAction;
  label: string;
  description: string;
  contexts?: AppContext[];
}

export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  { id: "trust", label: "Trust & Permissions", description: "Manage directory trust and capabilities" },
  { id: "theme", label: "Theme", description: "Change color theme preferences" },
  { id: "provider", label: "Provider", description: "Select AI provider for code review" },
  { id: "diagnostics", label: "Diagnostics", description: "Run system health checks" },
];
