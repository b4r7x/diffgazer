import { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useInput } from "ink";
import { inkKeyToHotkey, isLetterKey } from "../../lib/ink-key.js";

/** @see libs/keys/src/providers/keyboard-provider.tsx KeyboardContextValue (browser-based variant with DOM event routing) */
export interface KeyboardContextValue {
  registerHandler: (
    scope: string,
    hotkey: string,
    handler: () => void,
  ) => () => void;
  registerGlobalHandler: (
    hotkey: string,
    handler: () => void,
  ) => () => void;
  pushScope: (name: string) => void;
  popScope: () => void;
  activeScope: string | null;
  setInputActive: (active: boolean) => void;
  inputActive: boolean;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);

interface ScopeEntry {
  name: string;
  handlers: Map<string, Set<() => void>>;
}

interface TerminalKeyboardProviderProps {
  children: ReactNode;
}

export function TerminalKeyboardProvider({
  children,
}: TerminalKeyboardProviderProps) {
  const [scopeStack, setScopeStack] = useState<string[]>([]);
  const scopeStackRef = useRef<string[]>([]);
  const scopesRef = useRef<Map<string, ScopeEntry>>(new Map());
  const globalHandlersRef = useRef<Map<string, Set<() => void>>>(new Map());
  const inputActiveRef = useRef(false);
  const [inputActive, setInputActiveState] = useState(false);

  // Stable-ref escape hatch: scopeStackRef is read ONLY inside the useInput
  // stdin-event callback (never during render), so mid-render writes are safe
  // under concurrent rendering. See AGENTS.md react-useref rules.
  scopeStackRef.current = scopeStack;

  const activeScope = scopeStack.length > 0
    ? scopeStack[scopeStack.length - 1] ?? null
    : null;

  const setInputActive = useCallback((active: boolean) => {
    if (inputActiveRef.current === active) return;
    inputActiveRef.current = active;
    setInputActiveState(active);
  }, []);

  const registerHandler = useCallback((
    scope: string,
    hotkey: string,
    handler: () => void,
  ): (() => void) => {
    const scopes = scopesRef.current;
    if (!scopes.has(scope)) {
      scopes.set(scope, { name: scope, handlers: new Map() });
    }
    const entry = scopes.get(scope)!;
    if (!entry.handlers.has(hotkey)) {
      entry.handlers.set(hotkey, new Set());
    }
    entry.handlers.get(hotkey)!.add(handler);

    return () => {
      const handlerSet = entry.handlers.get(hotkey);
      if (handlerSet) {
        handlerSet.delete(handler);
        if (handlerSet.size === 0) {
          entry.handlers.delete(hotkey);
        }
      }
      if (entry.handlers.size === 0) {
        scopes.delete(scope);
      }
    };
  }, []);

  const registerGlobalHandler = useCallback((
    hotkey: string,
    handler: () => void,
  ): (() => void) => {
    const globals = globalHandlersRef.current;
    if (!globals.has(hotkey)) {
      globals.set(hotkey, new Set());
    }
    globals.get(hotkey)!.add(handler);

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

    let handled = false;

    const stack = scopeStackRef.current;
    const currentScope = stack.length > 0
      ? stack[stack.length - 1]
      : null;

    if (currentScope) {
      const entry = scopesRef.current.get(currentScope);
      if (entry) {
        const handlers = entry.handlers.get(hotkey);
        if (handlers) {
          for (const handler of handlers) {
            handler();
          }
          handled = true;
        }
      }
    }

    if (!handled) {
      const globalHandlers = globalHandlersRef.current.get(hotkey);
      if (globalHandlers) {
        for (const handler of globalHandlers) {
          handler();
        }
      }
    }
  });

  const value = useMemo<KeyboardContextValue>(
    () => ({
      registerHandler,
      registerGlobalHandler,
      pushScope,
      popScope,
      activeScope,
      setInputActive,
      inputActive,
    }),
    [
      registerHandler,
      registerGlobalHandler,
      pushScope,
      popScope,
      activeScope,
      setInputActive,
      inputActive,
    ],
  );

  return (
    <KeyboardContext value={value}>
      {children}
    </KeyboardContext>
  );
}
