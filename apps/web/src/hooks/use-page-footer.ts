import { useEffect, useRef } from "react";
import { useFooter } from "@/components/layout";
import type { Shortcut } from "@/types/ui";

interface PageFooterOptions {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}

const EMPTY_SHORTCUTS: Shortcut[] = [];

function toKey(shortcuts: Shortcut[]): string {
  return JSON.stringify(shortcuts);
}

export function usePageFooter({
  shortcuts,
  rightShortcuts = EMPTY_SHORTCUTS,
}: PageFooterOptions): void {
  const { setShortcuts, setRightShortcuts } = useFooter();
  const prevRef = useRef({ left: "[]", right: "[]" });

  useEffect(() => {
    const leftKey = toKey(shortcuts);
    const rightKey = toKey(rightShortcuts);

    if (prevRef.current.left !== leftKey) {
      setShortcuts(shortcuts);
      prevRef.current.left = leftKey;
    }

    if (prevRef.current.right !== rightKey) {
      setRightShortcuts(rightShortcuts);
      prevRef.current.right = rightKey;
    }
  }, [shortcuts, rightShortcuts, setShortcuts, setRightShortcuts]);
}
