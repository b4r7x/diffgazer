import { useInput } from "ink";
import type { WizardMode } from "../types/index.js";

interface WizardNavigationOptions {
  onBack?: () => void;
  isActive?: boolean;
  /** Additional input handler for custom keys */
  onInput?: (input: string, key: { escape: boolean; return: boolean }) => void;
}

/**
 * Hook for standardized wizard step navigation.
 * Handles back navigation with 'b' key.
 */
export function useWizardNavigation({
  onBack,
  isActive = true,
  onInput,
}: WizardNavigationOptions): void {
  useInput(
    (input, key) => {
      if (!isActive) return;

      if (input === "b" && onBack) {
        onBack();
        return;
      }

      onInput?.(input, { escape: key.escape, return: key.return });
    },
    { isActive }
  );
}

interface FooterTextOptions {
  mode: WizardMode;
  hasBack: boolean;
  /** Action text for Enter key (default: "continue" for onboarding, "configure" for settings) */
  enterAction?: string;
  /** Extra hints to prepend (e.g., "[/] Search, Arrow keys to select") */
  prefix?: string;
}

/**
 * Generate standardized footer text for wizard steps.
 */
export function getWizardFooterText({
  mode,
  hasBack,
  enterAction,
  prefix = "Arrow keys to select",
}: FooterTextOptions): string {
  const action = enterAction ?? (mode === "onboarding" ? "continue" : "configure");
  const backHint = hasBack ? ", [b] Back" : "";
  return `${prefix}, Enter to ${action}${backHint}`;
}
