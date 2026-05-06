"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { isInputElement, matchesHotkey } from "../utils/keyboard-utils.js";

type Handler = (event: KeyboardEvent) => void;

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

export interface KeyboardContextValue {
  activeScope: string | null;
  pushScope: (scope: string) => () => void;
  register: (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => () => void;
}

export const KeyboardContext = createContext<KeyboardContextValue | undefined>(undefined);

function isWithinTarget(eventTarget: EventTarget | null, options?: HandlerOptions): boolean {
  if (!options?.targetRef || !options.requireFocusWithin) return true;
  const targetElement = options.targetRef.current;
  if (!targetElement || !(eventTarget instanceof Node)) return false;
  return targetElement.contains(eventTarget);
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  // scopeStack is intentionally stored in state (not a ref) so that changes
  // trigger re-renders, allowing context consumers to react to scope transitions.
  const [scopeStack, setScopeStack] = useState<Array<{ name: string; id: number }>>([{ name: "global", id: 0 }]);
  const handlers = useRef(new Map<string, HandlerMap>());
  const nextHandlerId = useRef(1);
  const nextScopeId = useRef(1);

  const activeScope = scopeStack[scopeStack.length - 1]?.name ?? null;

  const pushScope = useCallback((scope: string) => {
    const id = nextScopeId.current++;
    setScopeStack((prev) => [...prev, { name: scope, id }]);
    return () => {
      setScopeStack((prev) => {
        const next = prev.filter((entry) => entry.id !== id);
        if (!next.some((entry) => entry.name === scope)) {
          handlers.current.delete(scope);
        }
        return next;
      });
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;

      const isInput = isInputElement(event.target);

      if (!activeScope) return;

      const scopeHandlers = handlers.current.get(activeScope);
      if (!scopeHandlers) return;

      for (const [hotkey, entries] of scopeHandlers) {
        if (matchesHotkey(event, hotkey)) {
          for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
            const entry = entries[idx]!;
            if (isInput && !entry.options?.allowInInput) continue;
            if (!isWithinTarget(event.target, entry.options)) continue;

            if (entry.options?.preventDefault) {
              event.preventDefault();
            }

            try {
              entry.handler(event);
            } catch (error) {
              console.error(`[@diffgazer/keys] Handler error for "${hotkey}":`, error);
            }
            return;
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeScope]);

  const register = useCallback((scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => {
    let scopeHandlers = handlers.current.get(scope);
    if (!scopeHandlers) {
      scopeHandlers = new Map<string, HandlerEntry[]>();
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

  const contextValue = useMemo<KeyboardContextValue>(
    () => ({ activeScope, pushScope, register }),
    [activeScope, pushScope, register],
  );

  return <KeyboardContext.Provider value={contextValue}>{children}</KeyboardContext.Provider>;
}
