import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Shortcut } from "@stargazer/schemas/ui";

export type { Shortcut };

interface FooterContextValue {
  shortcuts: Shortcut[];
  rightShortcuts: Shortcut[];
  setShortcuts: (shortcuts: Shortcut[]) => void;
  setRightShortcuts: (shortcuts: Shortcut[]) => void;
}

const FooterContext = createContext<FooterContextValue | undefined>(undefined);

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: "?", label: "Help" },
  { key: "q", label: "Quit" },
];

export function FooterProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(DEFAULT_SHORTCUTS);
  const [rightShortcuts, setRightShortcuts] = useState<Shortcut[]>([]);

  const contextValue = useMemo(
    () => ({
      shortcuts,
      rightShortcuts,
      setShortcuts,
      setRightShortcuts,
    }),
    [shortcuts, rightShortcuts]
  );

  return <FooterContext.Provider value={contextValue}>{children}</FooterContext.Provider>;
}

export function useFooter(): FooterContextValue {
  const context = useContext(FooterContext);
  if (context === undefined) {
    throw new Error("useFooter must be used within a FooterProvider");
  }
  return context;
}
