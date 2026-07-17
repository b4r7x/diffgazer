import { useInput } from "ink";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef } from "react";
import { KeyboardContext, type KeyboardContextValue } from "../../hooks/use-keyboard";
import { inkKeyToHotkey, isTypeableShortcutKey } from "../../lib/ink-key";
import type { TerminalInputQueue } from "../../lib/terminal-input";

interface TerminalKeyboardProviderProps {
  children: ReactNode;
  terminalInputQueue?: TerminalInputQueue;
}

export function TerminalKeyboardProvider({
  children,
  terminalInputQueue,
}: TerminalKeyboardProviderProps) {
  const globalHandlersRef = useRef<Map<string, Set<() => void>>>(new Map());
  const inputActiveRef = useRef(false);

  const setInputActive = useCallback((active: boolean) => {
    inputActiveRef.current = active;
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

  useInput((input, key) => {
    if (terminalInputQueue?.consume() === "legacy-modified") return;

    const hotkey = inkKeyToHotkey(input, key);
    if (!hotkey) return;

    if (inputActiveRef.current && isTypeableShortcutKey(hotkey)) return;

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
      setInputActive,
    }),
    [registerGlobalHandler, setInputActive],
  );

  return <KeyboardContext value={value}>{children}</KeyboardContext>;
}
