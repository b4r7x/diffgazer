"use client";

import { useContext } from "react";
import {
  KeyboardRegistryContext,
  KeyboardScopeContext,
  type KeyboardContextValue,
  type KeyboardRegistryContextValue,
  type KeyboardScopeContextValue,
} from "../providers/keyboard-provider.js";

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
