import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Shortcut } from "../schemas/presentation/index";
import { areShortcutsEqual } from "../schemas/presentation/index";
import type { FooterActions, FooterData } from "./types";

const FooterDataContext = createContext<FooterData | null>(null);
const FooterActionsContext = createContext<FooterActions | null>(null);

const DEFAULT_SHORTCUTS: Shortcut[] = [{ key: "?", label: "Help" }];
const EMPTY_SHORTCUTS: Shortcut[] = [];

export interface FooterProviderProps {
  children: ReactNode;
  /**
   * Initial left shortcuts. Defaults to a single `?` Help affordance so the
   * footer is never empty before any screen mounts. Pass `[]` to start blank.
   */
  initialShortcuts?: Shortcut[];
  /** Initial right shortcuts. Defaults to empty. */
  initialRightShortcuts?: Shortcut[];
}

export function FooterProvider({
  children,
  initialShortcuts = DEFAULT_SHORTCUTS,
  initialRightShortcuts = EMPTY_SHORTCUTS,
}: FooterProviderProps) {
  const [shortcuts, setShortcutsState] = useState<Shortcut[]>(initialShortcuts);
  const [rightShortcuts, setRightShortcutsState] = useState<Shortcut[]>(initialRightShortcuts);

  const dataValue = useMemo<FooterData>(
    () => ({ shortcuts, rightShortcuts }),
    [shortcuts, rightShortcuts],
  );

  // Setters short-circuit on content-equal arrays so callers passing fresh
  // arrays with the same shortcuts do not trigger consumer re-renders.
  const actionsValue = useMemo<FooterActions>(
    () => ({
      setShortcuts: (next) =>
        setShortcutsState((prev) => (areShortcutsEqual(prev, next) ? prev : next)),
      setRightShortcuts: (next) =>
        setRightShortcutsState((prev) => (areShortcutsEqual(prev, next) ? prev : next)),
    }),
    [],
  );

  return createElement(
    FooterDataContext.Provider,
    { value: dataValue },
    createElement(FooterActionsContext.Provider, { value: actionsValue }, children),
  );
}

export function useFooterData(): FooterData {
  const ctx = useContext(FooterDataContext);
  if (ctx === null) {
    throw new Error("useFooterData must be used within a FooterProvider");
  }
  return ctx;
}

export function useFooterActions(): FooterActions {
  const ctx = useContext(FooterActionsContext);
  if (ctx === null) {
    throw new Error("useFooterActions must be used within a FooterProvider");
  }
  return ctx;
}
