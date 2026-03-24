import { createContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useInput } from "ink";
import type { Key } from "ink";

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
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);

interface ScopeEntry {
  name: string;
  handlers: Map<string, Set<() => void>>;
}

function inkKeyToHotkey(input: string, key: Key): string | null {
  if (key.escape) return "escape";
  if (key.return) return "return";
  if (key.upArrow) return "up";
  if (key.downArrow) return "down";
  if (key.leftArrow) return "left";
  if (key.rightArrow) return "right";
  if (key.tab) return "tab";
  if (key.backspace) return "backspace";
  if (key.delete) return "delete";
  if (input) return input;
  return null;
}

interface TerminalKeyboardProviderProps {
  children: ReactNode;
}

export function TerminalKeyboardProvider({
  children,
}: TerminalKeyboardProviderProps) {
  const [scopeStack, setScopeStack] = useState<string[]>([]);
  const scopesRef = useRef<Map<string, ScopeEntry>>(new Map());
  const globalHandlersRef = useRef<Map<string, Set<() => void>>>(new Map());

  const activeScope = scopeStack.length > 0
    ? scopeStack[scopeStack.length - 1] ?? null
    : null;

  const registerHandler = (
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
  };

  const registerGlobalHandler = (
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
  };

  const pushScope = (name: string) => {
    setScopeStack((prev) => [...prev, name]);
  };

  const popScope = () => {
    setScopeStack((prev) => prev.slice(0, -1));
  };

  useInput((input, key) => {
    const hotkey = inkKeyToHotkey(input, key);
    if (!hotkey) return;

    let handled = false;

    const currentScope = scopeStack.length > 0
      ? scopeStack[scopeStack.length - 1]
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

  const value: KeyboardContextValue = {
    registerHandler,
    registerGlobalHandler,
    pushScope,
    popScope,
    activeScope,
  };

  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}
