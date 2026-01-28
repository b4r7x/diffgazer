import { useEffect } from "react";
import { useFooter, type Shortcut } from "@/components/layout";

interface PageFooterOptions {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}

const EMPTY_SHORTCUTS: Shortcut[] = [];

export function usePageFooter({ shortcuts, rightShortcuts }: PageFooterOptions) {
  const { setShortcuts, setRightShortcuts } = useFooter();
  const right = rightShortcuts ?? EMPTY_SHORTCUTS;

  useEffect(() => {
    setShortcuts(shortcuts);
    setRightShortcuts(right);
  }, [shortcuts, right, setShortcuts, setRightShortcuts]);
}
