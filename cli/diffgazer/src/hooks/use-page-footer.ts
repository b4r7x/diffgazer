import { useEffect } from "react";
import { useFooterContext } from "../app/providers/footer-provider.js";
import type { Shortcut } from "@diffgazer/core/schemas/ui";

interface PageFooterOptions {
  shortcuts?: Shortcut[];
  rightShortcuts?: Shortcut[];
}

export function usePageFooter(options: PageFooterOptions): void {
  const { setShortcuts, setRightShortcuts } = useFooterContext();

  useEffect(() => {
    if (options.shortcuts) {
      setShortcuts(options.shortcuts);
    }
    if (options.rightShortcuts) {
      setRightShortcuts(options.rightShortcuts);
    }
    return () => {
      setShortcuts([]);
      setRightShortcuts([]);
    };
  }, []);  // Only on mount/unmount — shortcuts are static per screen
}
