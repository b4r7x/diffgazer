import { PROVIDER_CONSENT_NOTICE } from "../config/settings.js";

export type MenuAction =
  | "review-unstaged"
  | "review-staged"
  | "review-files"
  | "resume-review"
  | "history"
  | "settings"
  | "help"
  | "quit";

export type SettingsAction =
  | "trust"
  | "theme"
  | "provider"
  | "provider-consent"
  | "storage"
  | "agent-execution"
  | "analysis"
  | "diagnostics";

export interface NavItem {
  id: MenuAction;
  label: string;
  shortcut?: string;
  variant?: "default" | "danger";
  group: "review" | "navigation" | "system";
}

interface SettingsMenuItem {
  id: SettingsAction;
  label: string;
  description: string;
}

// Both home menus render these rows with the shared isMenuActionDisabled
// rules, with one deliberate divergence: the web menu keeps disabled rows
// focusable so they stay discoverable to assistive tech (APG guidance on
// focusable disabled controls), while the TUI menu skips them during
// navigation — a terminal highlight on a row that cannot run reads as broken.
export const MENU_ITEMS: NavItem[] = [
  { id: "review-unstaged", label: "Review Unstaged", shortcut: "r", group: "review" },
  { id: "review-staged", label: "Review Staged", shortcut: "R", group: "review" },
  { id: "review-files", label: "Review Specific Files", shortcut: "f", group: "review" },
  { id: "resume-review", label: "Resume Last Review", shortcut: "l", group: "review" },
  { id: "history", label: "History", shortcut: "h", group: "navigation" },
  { id: "settings", label: "Settings", shortcut: "s", group: "navigation" },
  { id: "help", label: "Help", shortcut: "?", group: "system" },
  { id: "quit", label: "Quit", shortcut: "q", variant: "danger", group: "system" },
];

export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  {
    id: "trust",
    label: "Trust & Permissions",
    description: "Manage repository trust and permissions",
  },
  { id: "theme", label: "Theme", description: "Change color theme preferences" },
  { id: "provider", label: "Provider", description: "Select AI provider for code review" },
  {
    id: "provider-consent",
    label: PROVIDER_CONSENT_NOTICE.title,
    description: "What a review sends to your provider, and when you accepted it",
  },
  { id: "storage", label: "Secrets Storage", description: "Choose where API keys are stored" },
  {
    id: "agent-execution",
    label: "Agent Execution",
    description: "Control how analysis agents are scheduled",
  },
  { id: "analysis", label: "Analysis", description: "Configure agents and context depth" },
  { id: "diagnostics", label: "Diagnostics", description: "Run system health checks" },
];
