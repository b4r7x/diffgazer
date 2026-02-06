import { useEffect } from "react";
import { useFooter } from "@/components/layout";
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
  const { setShortcuts, setRightShortcuts } = useFooter();

  useEffect(() => {
    setShortcuts(shortcuts);
  }, [shortcuts, setShortcuts]);

  useEffect(() => {
    setRightShortcuts(rightShortcuts);
  }, [rightShortcuts, setRightShortcuts]);
}
