import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Shortcut } from "@diffgazer/schemas/ui";

export type { Shortcut };

interface FooterDataContextValue {
  shortcuts: Shortcut[];
  rightShortcuts: Shortcut[];
}

interface FooterActionsContextValue {
  setShortcuts: (shortcuts: Shortcut[]) => void;
  setRightShortcuts: (shortcuts: Shortcut[]) => void;
}

type FooterContextValue = FooterDataContextValue & FooterActionsContextValue;

const FooterDataContext = createContext<FooterDataContextValue | undefined>(undefined);
const FooterActionsContext = createContext<FooterActionsContextValue | undefined>(undefined);

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: "?", label: "Help" },
];

export function FooterProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(DEFAULT_SHORTCUTS);
  const [rightShortcuts, setRightShortcuts] = useState<Shortcut[]>([]);

  const dataValue = useMemo<FooterDataContextValue>(() => ({ shortcuts, rightShortcuts }), [shortcuts, rightShortcuts]);

  const actionsValue = useMemo<FooterActionsContextValue>(
    () => ({ setShortcuts, setRightShortcuts }),
    [setShortcuts, setRightShortcuts],
  );

  return (
    <FooterDataContext.Provider value={dataValue}>
      <FooterActionsContext.Provider value={actionsValue}>
        {children}
      </FooterActionsContext.Provider>
    </FooterDataContext.Provider>
  );
}

export function useFooterData(): FooterDataContextValue {
  const context = useContext(FooterDataContext);
  if (context === undefined) {
    throw new Error("useFooterData must be used within a FooterProvider");
  }
  return context;
}

export function useFooterActions(): FooterActionsContextValue {
  const context = useContext(FooterActionsContext);
  if (context === undefined) {
    throw new Error("useFooterActions must be used within a FooterProvider");
  }
  return context;
}

export function useFooter(): FooterContextValue {
  return { ...useFooterData(), ...useFooterActions() };
}
