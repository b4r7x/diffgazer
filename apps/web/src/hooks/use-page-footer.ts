import { useEffect } from "react";
import { useFooterActions, useFooterData } from "@/components/layout";
import { areShortcutsEqual } from "@diffgazer/core/schemas/ui";
import type { Shortcut } from "@diffgazer/core/schemas/ui";

interface PageFooterOptions {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}

const EMPTY_SHORTCUTS: Shortcut[] = [];

export function usePageFooter({
  shortcuts,
  rightShortcuts = EMPTY_SHORTCUTS,
}: PageFooterOptions): void {
  const { shortcuts: currentShortcuts, rightShortcuts: currentRightShortcuts } = useFooterData();
  const { setShortcuts, setRightShortcuts } = useFooterActions();

  useEffect(() => {
    if (!areShortcutsEqual(currentShortcuts, shortcuts)) {
      setShortcuts(shortcuts);
    }
    if (!areShortcutsEqual(currentRightShortcuts, rightShortcuts)) {
      setRightShortcuts(rightShortcuts);
    }
  }, [
    currentRightShortcuts,
    currentShortcuts,
    rightShortcuts,
    setRightShortcuts,
    setShortcuts,
    shortcuts,
  ]);
}
