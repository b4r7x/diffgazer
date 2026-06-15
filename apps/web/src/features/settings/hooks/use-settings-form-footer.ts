import { usePageFooter } from "@diffgazer/core/footer";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { type UseActionRowNavigationReturn, useActionRowNavigation } from "@diffgazer/keys";
import type { RefObject } from "react";

export interface UseSettingsFormFooterOptions {
  disabledActions: readonly [boolean, boolean];
  canSave: boolean;
  onCancel: () => void;
  onSave: () => void;
  contentShortcuts: Shortcut[];
  rightShortcuts: Shortcut[];
  focusFallbackRef?: RefObject<HTMLElement | null>;
}

/**
 * Shared Cancel/Save action-row footer for the settings detail pages: the
 * identical two-action navigation config, the in-actions shortcut ternary, and
 * the footer registration. Callers supply the content-zone shortcuts and the
 * save dispatch.
 */
export function useSettingsFormFooter({
  disabledActions,
  canSave,
  onCancel,
  onSave,
  contentShortcuts,
  rightShortcuts,
  focusFallbackRef,
}: UseSettingsFormFooterOptions): UseActionRowNavigationReturn {
  const footer = useActionRowNavigation<readonly unknown[]>({
    enabled: true,
    actionCount: 2,
    disabledActions,
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: (index) => {
      if (index === 0) onCancel();
      else if (index === 1 && canSave) onSave();
    },
  });

  const footerShortcuts: Shortcut[] = footer.inActions
    ? [
        { key: "←/→", label: "Move Action" },
        {
          key: "Enter/Space",
          label: footer.focusedIndex === 0 ? "Cancel" : "Save",
          disabled: footer.isFocusedActionDisabled,
        },
      ]
    : contentShortcuts;

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts,
  });

  return footer;
}
