import { useInput } from "ink";
import type { ReactNode } from "react";
import { createContext, useCallback, useMemo, useRef, useState } from "react";
import { inkKeyToHotkey, isLetterKey } from "../../lib/ink-key";

/** @see libs/keys/src/providers/keyboard.tsx KeyboardContextValue (browser-based variant with DOM event routing) */
export interface KeyboardContextValue {
  registerGlobalHandler: (hotkey: string, handler: () => void) => () => void;
  pushScope: (name: string) => void;
  popScope: () => void;
  activeScope: string | null;
  setInputActive: (active: boolean) => void;
  inputActive: boolean;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);

interface TerminalKeyboardProviderProps {
  children: ReactNode;
}

export function TerminalKeyboardProvider({ children }: TerminalKeyboardProviderProps) {
  const [scopeStack, setScopeStack] = useState<string[]>([]);
  const globalHandlersRef = useRef<Map<string, Set<() => void>>>(new Map());
  const inputActiveRef = useRef(false);
  const [inputActive, setInputActiveState] = useState(false);

  const activeScope = scopeStack.length > 0 ? (scopeStack[scopeStack.length - 1] ?? null) : null;

  const setInputActive = useCallback((active: boolean) => {
    if (inputActiveRef.current === active) return;
    inputActiveRef.current = active;
    setInputActiveState(active);
  }, []);

  const registerGlobalHandler = useCallback((hotkey: string, handler: () => void): (() => void) => {
    const globals = globalHandlersRef.current;
    let handlers = globals.get(hotkey);
    if (!handlers) {
      handlers = new Set();
      globals.set(hotkey, handlers);
    }
    handlers.add(handler);

    return () => {
      const handlerSet = globals.get(hotkey);
      if (handlerSet) {
        handlerSet.delete(handler);
        if (handlerSet.size === 0) {
          globals.delete(hotkey);
        }
      }
    };
  }, []);

  const pushScope = useCallback((name: string) => {
    setScopeStack((prev) => {
      if (prev[prev.length - 1] === name) return prev;
      return [...prev, name];
    });
  }, []);

  const popScope = useCallback(() => {
    setScopeStack((prev) => prev.slice(0, -1));
  }, []);

  useInput((input, key) => {
    const hotkey = inkKeyToHotkey(input, key);
    if (!hotkey) return;

    if (inputActiveRef.current && isLetterKey(hotkey)) return;

    const globalHandlers = globalHandlersRef.current.get(hotkey);
    if (globalHandlers) {
      for (const handler of globalHandlers) {
        handler();
      }
    }
  });

  const value = useMemo<KeyboardContextValue>(
    () => ({
      registerGlobalHandler,
      pushScope,
      popScope,
      activeScope,
      setInputActive,
      inputActive,
    }),
    [registerGlobalHandler, pushScope, popScope, activeScope, setInputActive, inputActive],
  );

  return <KeyboardContext value={value}>{children}</KeyboardContext>;
}
