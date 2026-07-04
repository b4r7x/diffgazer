"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyHandler } from "../core/normalize-key-input.js";
import { DECLINE } from "../core/normalize-key-input.js";
import { getOwnerView, isEditableElement, isNode } from "../dom/element-guards.js";
import {
  eventMatchesParsedHotkey,
  type ParsedHotkey,
  parseHotkey,
  serializeParsedHotkey,
  type ValidateHotkey,
  warnUnknownModifier,
} from "../dom/hotkey.js";
import {
  type HandlerOptions,
  KeyboardRegistryContext,
  type KeyboardRegistryContextValue,
  KeyboardScopeContext,
  type KeyboardScopeContextValue,
} from "./keyboard-context.js";

export type { HandlerOptions } from "./keyboard-context.js";

interface HandlerEntry {
  id: number;
  handler: KeyHandler;
  parsed: ParsedHotkey;
  options?: HandlerOptions;
}

interface ImplicitHandlerEntry extends HandlerEntry {
  order: string;
}

type HandlerMap = Map<string, HandlerEntry[]>;
type ImplicitHandlerMap = Map<string, ImplicitHandlerEntry[]>;

interface ScopeStackEntry {
  name: string;
  id: number;
  order: string;
}

const IMPERATIVE_SCOPE_ORDER_PREFIX = "\uffff";
const REACT_ID_RADIX = 32;

function getScopeOrderSegments(order: string): number[] {
  const withoutMarker = order.replace(/^[:_]*[rR][:_]*/, "");
  const localIdMatch = withoutMarker.match(/^(.*)H([0-9A-V]+)[:_]*$/);
  const baseOrder = localIdMatch?.[1] ?? withoutMarker;
  const segments = (baseOrder.toLowerCase().match(/[0-9a-v]+/g) ?? []).map((segment) =>
    parseInt(segment, REACT_ID_RADIX),
  );
  const localId = localIdMatch?.[2];
  if (localId) segments.push(parseInt(localId.toLowerCase(), REACT_ID_RADIX));
  return segments;
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

function isEventWithinContainer(
  eventTarget: EventTarget | null,
  options?: HandlerOptions,
): boolean {
  const containerRef = options?.containerRef;
  const focusWithinOnly = options?.focusWithinOnly;
  if (!containerRef || !focusWithinOnly) return true;
  const container = containerRef.current;
  if (!container) return false;
  const View = getOwnerView(container);
  if (!isNode(eventTarget, View)) return false;
  return container.contains(eventTarget);
}

/**
 * Context provider that enables scoped keyboard handling for @diffgazer/keys
 * hooks. It listens for keydown events on the provider document's window.
 */
export function KeyboardProvider({
  children,
}: {
  /** Child elements rendered under the keyboard provider. */
  children: ReactNode;
}) {
  const [scopeStack, setScopeStack] = useState<ScopeStackEntry[]>(() => [
    { name: "global", id: 0, order: "" },
  ]);
  const scopeStackRef = useRef(scopeStack);
  const handlers = useRef(new Map<string, HandlerMap>());
  const implicitHandlers = useRef<ImplicitHandlerMap>(new Map());
  const nextHandlerId = useRef(1);
  const nextScopeId = useRef(1);

  const activeScope = scopeStack[scopeStack.length - 1]?.name ?? null;

  const getActiveScope = useCallback(
    () => scopeStackRef.current[scopeStackRef.current.length - 1]?.name ?? null,
    [],
  );

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
    const next = [...scopeStackRef.current, { name: scope, id, order: scopeOrder }].sort(
      compareScopeEntries,
    );
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
    const canonicalKeys = new Set([
      ...(scopeHandlers?.keys() ?? []),
      ...implicitHandlers.current.keys(),
    ]);
    if (canonicalKeys.size === 0) return;

    const isEditable = isEditableElement(event.target);

    for (const canonicalKey of canonicalKeys) {
      const explicitEntries = scopeHandlers?.get(canonicalKey) ?? [];
      const activeImplicitEntries = (implicitHandlers.current.get(canonicalKey) ?? []).filter(
        (entry) => getScopeForOrder(entry.order) === activeRegistrationScope,
      );
      const entries = [...explicitEntries, ...activeImplicitEntries].sort((a, b) => b.id - a.id);
      const firstEntry = entries[0];
      if (!firstEntry || !eventMatchesParsedHotkey(event, firstEntry.parsed)) continue;

      for (const entry of entries) {
        if (isEditable && !entry.options?.allowInInput) continue;
        if (!isEventWithinContainer(event.target, entry.options)) continue;

        try {
          const result = entry.handler(event);
          if (result === DECLINE) continue;
          if (entry.options?.preventDefault) {
            event.preventDefault();
          }
        } catch (error) {
          console.error(`[@diffgazer/keys] Handler error for "${canonicalKey}":`, error);
        }
        return;
      }
    }
  });

  // The keydown listener is installed on `window`, so it only captures events
  // from the provider's own document; cross-document scenarios (iframes,
  // multi-window) need a provider per document.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleKeyDown(event);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const register = useCallback(
    <S extends string>(
      scope: string,
      hotkey: ValidateHotkey<S>,
      handler: KeyHandler,
      options?: HandlerOptions,
    ) => {
      const parsed = parseHotkey(hotkey as string);
      if (parsed.unknownModifier) {
        warnUnknownModifier("register", hotkey as string);
      }
      const canonical = serializeParsedHotkey(parsed);
      let scopeHandlers = handlers.current.get(scope);
      if (!scopeHandlers) {
        scopeHandlers = new Map<string, HandlerEntry[]>();
        handlers.current.set(scope, scopeHandlers);
      }

      const existingEntries = scopeHandlers.get(canonical) ?? [];
      const entry: HandlerEntry = {
        id: nextHandlerId.current,
        handler,
        parsed,
        options,
      };
      nextHandlerId.current += 1;
      scopeHandlers.set(canonical, [...existingEntries, entry]);

      return () => {
        const activeScopeHandlers = handlers.current.get(scope);
        if (!activeScopeHandlers) return;

        const currentEntries = activeScopeHandlers.get(canonical);
        if (!currentEntries) return;

        const remainingEntries = currentEntries.filter((candidate) => candidate.id !== entry.id);
        if (remainingEntries.length === 0) {
          activeScopeHandlers.delete(canonical);
          if (activeScopeHandlers.size === 0) {
            handlers.current.delete(scope);
          }
        } else {
          activeScopeHandlers.set(canonical, remainingEntries);
        }
      };
    },
    [],
  );

  const registerImplicit = useCallback(
    <S extends string>(
      order: string,
      hotkey: ValidateHotkey<S>,
      handler: KeyHandler,
      options?: HandlerOptions,
    ) => {
      const parsed = parseHotkey(hotkey as string);
      if (parsed.unknownModifier) {
        warnUnknownModifier("registerImplicit", hotkey as string);
      }
      const canonical = serializeParsedHotkey(parsed);
      const existingEntries = implicitHandlers.current.get(canonical) ?? [];
      const entry: ImplicitHandlerEntry = {
        id: nextHandlerId.current,
        handler,
        parsed,
        options,
        order,
      };
      nextHandlerId.current += 1;
      implicitHandlers.current.set(canonical, [...existingEntries, entry]);

      return () => {
        const currentEntries = implicitHandlers.current.get(canonical);
        if (!currentEntries) return;

        const remainingEntries = currentEntries.filter((candidate) => candidate.id !== entry.id);
        if (remainingEntries.length === 0) {
          implicitHandlers.current.delete(canonical);
        } else {
          implicitHandlers.current.set(canonical, remainingEntries);
        }
      };
    },
    [],
  );

  const registryValue = useMemo<KeyboardRegistryContextValue>(
    () => ({ getActiveScope, pushScope, register, registerImplicit }),
    [getActiveScope, pushScope, register, registerImplicit],
  );

  const scopeValue = useMemo<KeyboardScopeContextValue>(() => ({ activeScope }), [activeScope]);

  return (
    <KeyboardRegistryContext value={registryValue}>
      <KeyboardScopeContext value={scopeValue}>{children}</KeyboardScopeContext>
    </KeyboardRegistryContext>
  );
}
