import { useLayoutEffect, useRef } from "react";
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
  const prevRef = useRef<{ shortcuts: Shortcut[]; rightShortcuts: Shortcut[] } | null>(null);

  useLayoutEffect(() => {
    if (prevRef.current?.shortcuts !== shortcuts) {
      prevRef.current = { shortcuts, rightShortcuts: prevRef.current?.rightShortcuts ?? rightShortcuts };
      setShortcuts(shortcuts);
    }
    if (prevRef.current?.rightShortcuts !== rightShortcuts) {
      prevRef.current = { shortcuts: prevRef.current?.shortcuts ?? shortcuts, rightShortcuts };
      setRightShortcuts(rightShortcuts);
    }
  });
}
