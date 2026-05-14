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
import { DECLINE } from "../core/normalize-key-input.js";
import { getOwnerView } from "../dom/dom.js";
import { isEditableElement, matchesHotkey } from "../dom/keyboard-utils.js";

type Handler = (event: KeyboardEvent) => unknown;

export interface HandlerOptions {
  allowInInput?: boolean;
  containerRef?: RefObject<HTMLElement | null>;
  focusWithinOnly?: boolean;
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
  order: string;
}

const IMPERATIVE_SCOPE_ORDER_PREFIX = "\uffff";
const REACT_ID_RADIX = 32;

function getScopeOrderSegments(order: string): number[] {
  return (order.toLowerCase().match(/[0-9a-v]+/g) ?? []).map((segment) => parseInt(segment, REACT_ID_RADIX));
}

function compareScopeEntries(a: ScopeStackEntry, b: ScopeStackEntry): number {
  const aImperative = a.order.startsWith(IMPERATIVE_SCOPE_ORDER_PREFIX);
  const bImperative = b.order.startsWith(IMPERATIVE_SCOPE_ORDER_PREFIX);
  if (aImperative !== bImperative) return aImperative ? 1 : -1;
  if (aImperative && bImperative) return a.id - b.id;

  const aSegments = getScopeOrderSegments(a.order);
  const bSegments = getScopeOrderSegments(b.order);
  const length = Math.max(aSegments.length, bSegments.length);
  for (let index = 0; index < length; index += 1) {
    const aValue = aSegments[index] ?? -1;
    const bValue = bSegments[index] ?? -1;
    if (aValue !== bValue) return aValue - bValue;
  }
  return a.id - b.id;
}

export interface KeyboardContextValue {
  activeScope: string | null;
  getActiveScope: () => string | null;
  pushScope: (scope: string) => () => void;
  register: (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => () => void;
}

export interface KeyboardRegistryContextValue {
  getActiveScope: () => string | null;
  getScopeForOrder: (order: string) => string | null;
  pushScope: (scope: string, order?: string) => () => void;
  register: (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => () => void;
}

export interface KeyboardScopeContextValue {
  activeScope: string | null;
}

export const KeyboardRegistryContext = createContext<KeyboardRegistryContextValue | undefined>(undefined);
export const KeyboardScopeContext = createContext<KeyboardScopeContextValue | undefined>(undefined);

function isEventWithinContainer(eventTarget: EventTarget | null, options?: HandlerOptions): boolean {
  const containerRef = options?.containerRef;
  const focusWithinOnly = options?.focusWithinOnly;
  if (!containerRef || !focusWithinOnly) return true;
  const container = containerRef.current;
  if (!container) return false;
  const View = getOwnerView(container);
  if (!View || !(eventTarget instanceof View.Node)) return false;
  return container.contains(eventTarget);
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [scopeStack, setScopeStack] = useState<ScopeStackEntry[]>(() => [{ name: "global", id: 0, order: "" }]);
  const scopeStackRef = useRef(scopeStack);
  const handlers = useRef(new Map<string, HandlerMap>());
  const nextHandlerId = useRef(1);
  const nextScopeId = useRef(1);

  const activeScope = scopeStack[scopeStack.length - 1]?.name ?? null;

  const getActiveScope = useCallback(() => scopeStackRef.current[scopeStackRef.current.length - 1]?.name ?? null, []);

  const getScopeForOrder = useCallback((order: string) => {
    const stack = scopeStackRef.current;
    const activeEntry = stack[stack.length - 1];
    if (activeEntry?.order.startsWith(IMPERATIVE_SCOPE_ORDER_PREFIX)) return activeEntry.name;

    const handlerEntry: ScopeStackEntry = {
      name: "",
      id: Number.MAX_SAFE_INTEGER,
      order,
    };
    const precedingScopes = stack.filter((entry) => compareScopeEntries(entry, handlerEntry) <= 0);
    return precedingScopes[precedingScopes.length - 1]?.name ?? stack[0]?.name ?? null;
  }, []);

  const pushScope = useCallback((scope: string, order?: string) => {
    const id = nextScopeId.current++;
    const scopeOrder = order ?? `${IMPERATIVE_SCOPE_ORDER_PREFIX}${String(id).padStart(8, "0")}`;
    const next = [...scopeStackRef.current, { name: scope, id, order: scopeOrder }]
      .sort(compareScopeEntries);
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

    const isEditable = isEditableElement(event.target);

    for (const [hotkey, entries] of scopeHandlers) {
      if (!matchesHotkey(event, hotkey)) continue;

      for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
        const entry = entries[idx]!;
        if (isEditable && !entry.options?.allowInInput) continue;
        if (!isEventWithinContainer(event.target, entry.options)) continue;

        if (entry.options?.preventDefault) {
          event.preventDefault();
        }

        try {
          const result = entry.handler(event);
          if (result === DECLINE) continue;
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
    () => ({ getActiveScope, getScopeForOrder, pushScope, register }),
    [getActiveScope, getScopeForOrder, pushScope, register],
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
