import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type ReactElement,
} from "react";

type KeyboardMode = "menu" | "keys";

export interface KeyboardModeContextValue {
  mode: KeyboardMode;
  isKeyMode: boolean;
  isMenuMode: boolean;
  toggleMode: () => void;
  setMode: (mode: KeyboardMode) => void;
}

const KeyboardModeContext = createContext<KeyboardModeContextValue | null>(null);

interface KeyModeProviderProps {
  initialMode?: KeyboardMode;
  children: ReactNode;
}

export function KeyModeProvider({
  initialMode = "menu",
  children,
}: KeyModeProviderProps): ReactElement {
  const [mode, setModeState] = useState<KeyboardMode>(initialMode);

  const toggleMode = useCallback(() => {
    setModeState((current: KeyboardMode) => (current === "menu" ? "keys" : "menu"));
  }, []);

  const setMode = useCallback((newMode: KeyboardMode) => {
    setModeState(newMode);
  }, []);

  const value = useMemo<KeyboardModeContextValue>(
    () => ({
      mode,
      isKeyMode: mode === "keys",
      isMenuMode: mode === "menu",
      toggleMode,
      setMode,
    }),
    [mode, toggleMode, setMode]
  );

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
