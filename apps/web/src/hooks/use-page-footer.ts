import { useLayoutEffect } from "react";
import { useFooterActions } from "@/components/layout";
import type { Shortcut } from "@stargazer/schemas/ui";

interface PageFooterOptions {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}

const EMPTY_SHORTCUTS: Shortcut[] = [];

export function usePageFooter({
  shortcuts,
  rightShortcuts = EMPTY_SHORTCUTS,
}: PageFooterOptions): void {
  const { setShortcuts, setRightShortcuts } = useFooterActions();

  useLayoutEffect(() => {
    setShortcuts(shortcuts);
    setRightShortcuts(rightShortcuts);
  }, [shortcuts, rightShortcuts, setShortcuts, setRightShortcuts]);
}
