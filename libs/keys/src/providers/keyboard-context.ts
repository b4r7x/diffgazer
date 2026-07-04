"use client";

import { createContext, type RefObject, useContext } from "react";
import type { KeyHandler } from "../core/normalize-key-input.js";
import type { ValidateHotkey } from "../dom/hotkey.js";

/** Options shared by provider-registered keyboard handlers. */
export interface HandlerOptions {
  /** Allow the handler to fire while a text-editable element is focused. */
  allowInInput?: boolean;
  /** DOM boundary used by `focusWithinOnly` to restrict handler dispatch. */
  containerRef?: RefObject<HTMLElement | null>;
  /** Only fire the handler when focus is within the container element. */
  focusWithinOnly?: boolean;
  /** Call preventDefault() on the keyboard event when the hotkey matches. */
  preventDefault?: boolean;
}

/** Public keyboard context value returned by `useKeyboardContext`. */
export interface KeyboardContextValue {
  /** Currently active keyboard scope name, or null when no scope is active. */
  activeScope: string | null;
  /** Returns the currently active keyboard scope at call time. */
  getActiveScope: () => string | null;
  /** Imperatively pushes a scope and returns a cleanup function that pops it. */
  pushScope: (scope: string) => () => void;
  /** Registers a hotkey handler under a scope and returns an unregister function. */
  register: <S extends string>(
    scope: string,
    hotkey: ValidateHotkey<S>,
    handler: KeyHandler,
    options?: HandlerOptions,
  ) => () => void;
}

/** Internal registry context consumed by provider-backed hooks. */
export interface KeyboardRegistryContextValue {
  /** Returns the currently active keyboard scope at call time. */
  getActiveScope: () => string | null;
  /** Pushes a scope, optionally at a declarative React id order. */
  pushScope: (scope: string, order?: string) => () => void;
  /** Registers a hotkey handler under a scope and returns an unregister function. */
  register: <S extends string>(
    scope: string,
    hotkey: ValidateHotkey<S>,
    handler: KeyHandler,
    options?: HandlerOptions,
  ) => () => void;
  /** Registers a hotkey whose owning scope is resolved from React id order at dispatch time. */
  registerImplicit: <S extends string>(
    order: string,
    hotkey: ValidateHotkey<S>,
    handler: KeyHandler,
    options?: HandlerOptions,
  ) => () => void;
}

/** Active scope context value exposed beside the registry context. */
export interface KeyboardScopeContextValue {
  /** Currently active keyboard scope name, or null when no scope is active. */
  activeScope: string | null;
}

/** React context carrying the keyboard registry functions. */
export const KeyboardRegistryContext = createContext<KeyboardRegistryContextValue | undefined>(
  undefined,
);

/** React context carrying the currently active scope. */
export const KeyboardScopeContext = createContext<KeyboardScopeContextValue | undefined>(undefined);

const KEYBOARD_PROVIDER_ERROR = "useKeyboardContext must be used within KeyboardProvider";

/** Returns the keyboard registry context or throws when no provider is mounted. */
export function useKeyboardRegistryContext(): KeyboardRegistryContextValue {
  const ctx = useContext(KeyboardRegistryContext);
  if (ctx === undefined) {
    throw new Error(KEYBOARD_PROVIDER_ERROR);
  }
  return ctx;
}

/** Returns the active-scope context or throws when no provider is mounted. */
export function useKeyboardScopeContext(): KeyboardScopeContextValue {
  const ctx = useContext(KeyboardScopeContext);
  if (ctx === undefined) {
    throw new Error(KEYBOARD_PROVIDER_ERROR);
  }
  return ctx;
}

/** Returns the active keyboard context and throws if `KeyboardProvider` is missing. */
export function useKeyboardContext(): KeyboardContextValue {
  const registry = useKeyboardRegistryContext();
  const scope = useKeyboardScopeContext();

  return { activeScope: scope.activeScope, ...registry };
}

/** Returns the active keyboard context or null if `KeyboardProvider` is missing. */
export function useOptionalKeyboardContext(): KeyboardContextValue | null {
  const registry = useContext(KeyboardRegistryContext);
  const scope = useContext(KeyboardScopeContext);

  if (registry === undefined || scope === undefined) return null;
  return { activeScope: scope.activeScope, ...registry };
}

/** Returns the registry context or null if `KeyboardProvider` is missing. */
export function useOptionalKeyboardRegistryContext(): KeyboardRegistryContextValue | null {
  return useContext(KeyboardRegistryContext) ?? null;
}
