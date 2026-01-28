import { createContext, useContext, useState, type ReactNode } from "react";

export interface Shortcut {
  key: string;
  label: string;
}

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

  return (
    <FooterContext.Provider
      value={{ shortcuts, rightShortcuts, setShortcuts, setRightShortcuts }}
    >
      {children}
    </FooterContext.Provider>
  );
}

export function useFooter() {
  const context = useContext(FooterContext);
  if (context === undefined) {
    throw new Error("useFooter must be used within a FooterProvider");
  }
  return context;
}
