import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { Shortcut } from "@diffgazer/schemas/ui";

interface FooterContextValue {
  shortcuts: Shortcut[];
  rightShortcuts: Shortcut[];
  setShortcuts: (shortcuts: Shortcut[]) => void;
  setRightShortcuts: (shortcuts: Shortcut[]) => void;
}

export const FooterContext = createContext<FooterContextValue | null>(null);

interface FooterProviderProps {
  children: ReactNode;
}

export function FooterProvider({ children }: FooterProviderProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [rightShortcuts, setRightShortcuts] = useState<Shortcut[]>([]);

  const value: FooterContextValue = {
    shortcuts,
    rightShortcuts,
    setShortcuts,
    setRightShortcuts,
  };

  return (
    <FooterContext.Provider value={value}>{children}</FooterContext.Provider>
  );
}

export function useFooterContext(): FooterContextValue {
  const context = useContext(FooterContext);
  if (!context) {
    throw new Error("useFooterContext must be used within a FooterProvider");
  }
  return context;
}
