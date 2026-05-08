"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
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

interface ScopeStackEntry {
  name: string;
  id: number;
}

export interface KeyboardContextValue {
  activeScope: string | null;
  getActiveScope: () => string | null;
  pushScope: (scope: string) => () => void;
  register: (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => () => void;
}

export interface KeyboardRegistryContextValue {
  getActiveScope: () => string | null;
  pushScope: (scope: string) => () => void;
  register: (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => () => void;
}

export interface KeyboardScopeContextValue {
  activeScope: string | null;
}

export const KeyboardRegistryContext = createContext<KeyboardRegistryContextValue | undefined>(undefined);
export const KeyboardScopeContext = createContext<KeyboardScopeContextValue | undefined>(undefined);

function isWithinTarget(eventTarget: EventTarget | null, options?: HandlerOptions): boolean {
  if (!options?.targetRef || !options.requireFocusWithin) return true;
  const targetElement = options.targetRef.current;
  if (!targetElement || !(eventTarget instanceof Node)) return false;
  return targetElement.contains(eventTarget);
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [scopeStack, setScopeStack] = useState<ScopeStackEntry[]>(() => [{ name: "global", id: 0 }]);
  const scopeStackRef = useRef(scopeStack);
  const handlers = useRef(new Map<string, HandlerMap>());
  const nextHandlerId = useRef(1);
  const nextScopeId = useRef(1);

  const activeScope = scopeStack[scopeStack.length - 1]?.name ?? null;

  const getActiveScope = useCallback(() => scopeStackRef.current[scopeStackRef.current.length - 1]?.name ?? null, []);

  const pushScope = useCallback((scope: string) => {
    const id = nextScopeId.current++;
    const next = [...scopeStackRef.current, { name: scope, id }];
    scopeStackRef.current = next;
    setScopeStack(next);

    return () => {
      const next = scopeStackRef.current.filter((entry) => entry.id !== id);
      scopeStackRef.current = next;
      setScopeStack(next);
    };
  }, []);

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) return;

    const activeRegistrationScope = getActiveScope();
    if (!activeRegistrationScope) return;

    const scopeHandlers = handlers.current.get(activeRegistrationScope);
    if (!scopeHandlers) return;

    const isInput = isInputElement(event.target);

    for (const [hotkey, entries] of scopeHandlers) {
      if (!matchesHotkey(event, hotkey)) continue;

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
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleKeyDown(event);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
        if (activeScopeHandlers.size === 0) {
          handlers.current.delete(scope);
        }
      } else {
        activeScopeHandlers.set(hotkey, remainingEntries);
      }
    };
  }, []);

  const registryValue = useMemo<KeyboardRegistryContextValue>(
    () => ({ getActiveScope, pushScope, register }),
    [getActiveScope, pushScope, register],
  );

  const scopeValue = useMemo<KeyboardScopeContextValue>(
    () => ({ activeScope }),
    [activeScope],
  );

  return (
    <KeyboardRegistryContext.Provider value={registryValue}>
      <KeyboardScopeContext.Provider value={scopeValue}>
        {children}
      </KeyboardScopeContext.Provider>
    </KeyboardRegistryContext.Provider>
  );
}
