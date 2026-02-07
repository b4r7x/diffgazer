import { useEffect } from "react";
import { useFooterActions, useFooterData } from "@/components/layout";
import type { Shortcut } from "@stargazer/schemas/ui";

interface PageFooterOptions {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}

const EMPTY_SHORTCUTS: Shortcut[] = [];

function areShortcutsEqual(a: Shortcut[], b: Shortcut[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left.key !== right.key || left.label !== right.label || left.disabled !== right.disabled) {
      return false;
    }
  }

  return true;
}

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
