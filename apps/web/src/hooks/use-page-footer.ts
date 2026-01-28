import { useEffect } from "react";
import { useFooter, type Shortcut } from "@/components/layout";

interface PageFooterOptions {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}

export function usePageFooter({ shortcuts, rightShortcuts = [] }: PageFooterOptions) {
  const { setShortcuts, setRightShortcuts } = useFooter();

  useEffect(() => {
    setShortcuts(shortcuts);
    setRightShortcuts(rightShortcuts);
  }, [shortcuts, rightShortcuts, setShortcuts, setRightShortcuts]);
}
