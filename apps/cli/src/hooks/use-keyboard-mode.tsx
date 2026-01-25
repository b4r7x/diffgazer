import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  type ReactElement,
} from "react";
import type { ControlsMode } from "@repo/schemas/settings";

export interface KeyboardModeContextValue {
  mode: ControlsMode;
  isKeyMode: boolean;
  isMenuMode: boolean;
  toggleMode: () => void;
  setMode: (mode: ControlsMode) => void;
}

const KeyboardModeContext = createContext<KeyboardModeContextValue | null>(null);

interface KeyModeProviderProps {
  initialMode?: ControlsMode;
  children: ReactNode;
}

export function KeyModeProvider({
  initialMode = "menu",
  children,
}: KeyModeProviderProps): ReactElement {
  const [mode, setModeState] = useState<ControlsMode>(initialMode);

  const toggleMode = useCallback(() => {
    setModeState((current) => (current === "menu" ? "keys" : "menu"));
  }, []);

  const setMode = useCallback((newMode: ControlsMode) => {
    setModeState(newMode);
  }, []);

  const value: KeyboardModeContextValue = {
    mode,
    isKeyMode: mode === "keys",
    isMenuMode: mode === "menu",
    toggleMode,
    setMode,
  };

  return (
    <KeyboardModeContext.Provider value={value}>
      {children}
    </KeyboardModeContext.Provider>
  );
}

const DEFAULT_VALUE: KeyboardModeContextValue = {
  mode: "menu",
  isKeyMode: false,
  isMenuMode: true,
  toggleMode: () => {},
  setMode: () => {},
};

export function useKeyboardMode(): KeyboardModeContextValue {
  const context = useContext(KeyboardModeContext);
  if (!context) {
    return DEFAULT_VALUE;
  }
  return context;
}

export { KeyboardModeContext };
