"use client";

import { createContext, type RefObject, useContext } from "react";

export type Handler = (event: KeyboardEvent) => unknown;

export interface HandlerOptions {
  allowInInput?: boolean;
  containerRef?: RefObject<HTMLElement | null>;
  focusWithinOnly?: boolean;
  preventDefault?: boolean;
}

export interface KeyboardContextValue {
  activeScope: string | null;
  getActiveScope: () => string | null;
  pushScope: (scope: string) => () => void;
  register: (
    scope: string,
    hotkey: string,
    handler: Handler,
    options?: HandlerOptions,
  ) => () => void;
}

export interface KeyboardRegistryContextValue {
  getActiveScope: () => string | null;
  getScopeForOrder: (order: string) => string | null;
  pushScope: (scope: string, order?: string) => () => void;
  register: (
    scope: string,
    hotkey: string,
    handler: Handler,
    options?: HandlerOptions,
  ) => () => void;
}

export interface KeyboardScopeContextValue {
  activeScope: string | null;
}

export const KeyboardRegistryContext = createContext<KeyboardRegistryContextValue | undefined>(
  undefined,
);
export const KeyboardScopeContext = createContext<KeyboardScopeContextValue | undefined>(undefined);

const KEYBOARD_PROVIDER_ERROR = "useKeyboardContext must be used within KeyboardProvider";

export function useKeyboardRegistryContext(): KeyboardRegistryContextValue {
  const ctx = useContext(KeyboardRegistryContext);
  if (ctx === undefined) {
    throw new Error(KEYBOARD_PROVIDER_ERROR);
  }
  return ctx;
}

export function useKeyboardScopeContext(): KeyboardScopeContextValue {
  const ctx = useContext(KeyboardScopeContext);
  if (ctx === undefined) {
    throw new Error(KEYBOARD_PROVIDER_ERROR);
  }
  return ctx;
}

export function useKeyboardContext(): KeyboardContextValue {
  const registry = useKeyboardRegistryContext();
  const scope = useKeyboardScopeContext();

  return { activeScope: scope.activeScope, ...registry };
}

export function useOptionalKeyboardContext(): KeyboardContextValue | null {
  const registry = useContext(KeyboardRegistryContext);
  const scope = useContext(KeyboardScopeContext);

  if (registry === undefined || scope === undefined) return null;
  return { activeScope: scope.activeScope, ...registry };
}

export function useOptionalKeyboardRegistryContext(): KeyboardRegistryContextValue | null {
  return useContext(KeyboardRegistryContext) ?? null;
}
