import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isInputElement, matchesHotkey } from "@/app/providers/keyboard-utils";

type Handler = () => void;

interface HandlerOptions {
  allowInInput?: boolean;
}

interface HandlerEntry {
  handler: Handler;
  options?: HandlerOptions;
}

type HandlerMap = Map<string, HandlerEntry>;

interface KeyboardContextValue {
  activeScope: string | null;
  pushScope: (scope: string) => () => void;
  register: (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => () => void;
}

export const KeyboardContext = createContext<KeyboardContextValue | undefined>(undefined);

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [scopeStack, setScopeStack] = useState<string[]>(["global"]);
  const handlers = useRef(new Map<string, HandlerMap>());

  const activeScope = scopeStack[scopeStack.length - 1] ?? null;

  const pushScope = (scope: string) => {
    setScopeStack((prev) => [...prev, scope]);
    return () => {
      setScopeStack((prev) => {
        const idx = prev.lastIndexOf(scope);
        if (idx < 0) return prev;
        const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        // Clean up handlers if this scope is no longer in the stack
        if (!next.includes(scope)) {
          handlers.current.delete(scope);
        }
        return next;
      });
    };
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!activeScope) return;

      const scopeHandlers = handlers.current.get(activeScope);
      if (!scopeHandlers) return;

      const isInput = isInputElement(event.target);

      for (const [hotkey, entry] of scopeHandlers) {
        if (isInput && !entry.options?.allowInInput) continue;
        if (matchesHotkey(event, hotkey)) {
          event.preventDefault();
          entry.handler();
          break;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeScope]);

  const register = (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => {
    const scopeHandlers = handlers.current.get(scope) ?? new Map<string, HandlerEntry>();
    if (!handlers.current.has(scope)) handlers.current.set(scope, scopeHandlers);
    scopeHandlers.set(hotkey, { handler, options });
    return () => handlers.current.get(scope)?.delete(hotkey);
  };

  const contextValue = useMemo(
    () => ({ activeScope, pushScope, register }),
    [activeScope, pushScope, register]
  );

  return <KeyboardContext.Provider value={contextValue}>{children}</KeyboardContext.Provider>;
}

