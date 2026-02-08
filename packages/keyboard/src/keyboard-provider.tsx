import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { isInputElement, matchesHotkey } from "./keyboard-utils";

type Handler = () => void;

export interface HandlerOptions {
  allowInInput?: boolean;
  targetRef?: RefObject<HTMLElement | null>;
  requireFocusWithin?: boolean;
  preventDefault?: boolean;
}

interface HandlerEntry {
  id: number;
  handler: Handler;
  options?: HandlerOptions;
}

type HandlerMap = Map<string, HandlerEntry[]>;

interface KeyboardContextValue {
  activeScope: string | null;
  pushScope: (scope: string) => () => void;
  register: (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => () => void;
}

export const KeyboardContext = createContext<KeyboardContextValue | undefined>(undefined);

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [scopeStack, setScopeStack] = useState<string[]>(["global"]);
  const scopeStackRef = useRef(scopeStack);
  scopeStackRef.current = scopeStack;
  const handlers = useRef(new Map<string, HandlerMap>());
  const nextHandlerId = useRef(1);

  const activeScope = scopeStack[scopeStack.length - 1] ?? null;

  const isWithinTarget = useCallback(
    (eventTarget: EventTarget | null, options?: HandlerOptions): boolean => {
      if (!options?.targetRef || !options.requireFocusWithin) return true;
      const targetElement = options.targetRef.current;
      if (!targetElement || !(eventTarget instanceof Node)) return false;
      return targetElement.contains(eventTarget);
    },
    []
  );

  const pushScope = useCallback((scope: string) => {
    setScopeStack((prev) => [...prev, scope]);
    return () => {
      setScopeStack((prev) => {
        const idx = prev.lastIndexOf(scope);
        if (idx < 0) return prev;
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
      queueMicrotask(() => {
        if (!scopeStackRef.current.includes(scope)) {
          handlers.current.delete(scope);
        }
      });
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!activeScope) return;

      const scopeHandlers = handlers.current.get(activeScope);
      if (!scopeHandlers) return;

      const isInput = isInputElement(event.target);

      for (const [hotkey, entries] of scopeHandlers) {
        if (matchesHotkey(event, hotkey)) {
          for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
            const entry = entries[idx];
            if (!entry) continue;
            if (isInput && !entry.options?.allowInInput) continue;
            if (!isWithinTarget(event.target, entry.options)) continue;

            if (entry.options?.preventDefault !== false) {
              event.preventDefault();
            }

            entry.handler();
            return;
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeScope, isWithinTarget]);

  const register = useCallback((scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => {
    const scopeHandlers = handlers.current.get(scope) ?? new Map<string, HandlerEntry[]>();
    if (!handlers.current.has(scope)) {
      handlers.current.set(scope, scopeHandlers);
    }

    const existingEntries = scopeHandlers.get(hotkey) ?? [];
    const entry: HandlerEntry = {
      id: nextHandlerId.current,
      handler,
      options,
    };
    nextHandlerId.current += 1;
    scopeHandlers.set(hotkey, [...existingEntries, entry]);

    return () => {
      const activeScopeHandlers = handlers.current.get(scope);
      if (!activeScopeHandlers) return;

      const currentEntries = activeScopeHandlers.get(hotkey);
      if (!currentEntries) return;

      const remainingEntries = currentEntries.filter((candidate) => candidate.id !== entry.id);
      if (remainingEntries.length === 0) {
        activeScopeHandlers.delete(hotkey);
      } else {
        activeScopeHandlers.set(hotkey, remainingEntries);
      }
    };
  }, []);

  const contextValue = useMemo<KeyboardContextValue>(() => ({ activeScope, pushScope, register }), [activeScope, pushScope, register]);

  return <KeyboardContext.Provider value={contextValue}>{children}</KeyboardContext.Provider>;
}
