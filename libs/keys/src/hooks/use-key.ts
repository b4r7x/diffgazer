"use client";

import { useEffectEvent, useId, useLayoutEffect } from "react";
import type { KeyHandler } from "../core/normalize-key-input.js";
import { normalizeKeyInput } from "../core/normalize-key-input.js";
import type { ValidateHotkey } from "../dom/hotkey.js";
import {
  type HandlerOptions,
  useOptionalKeyboardRegistryContext,
} from "../providers/keyboard-context.js";

/** Options for registering one or more hotkeys with `useKey`. */
export interface UseKeyOptions extends HandlerOptions {
  /** Whether the binding is active. */
  enabled?: boolean;
  /**
   * Explicit keyboard scope to register under. Pass null to skip registration.
   * Defaults to the nearest active provider scope for this hook's declaration order.
   */
  scope?: string | null;
}

/**
 * Compile-time validation for the map overload: a key whose modifier segment is
 * outside the closed {@link ValidateHotkey} vocabulary resolves to an
 * unassignable message type, mirroring the single/array overloads. Maps typed as
 * plain `Record<string, KeyHandler>` pass through so dynamic maps keep compiling.
 */
type ValidateHotkeyMap<Handlers> = {
  [K in keyof Handlers & string]: ValidateHotkey<K> extends never
    ? `Unknown hotkey modifier in "${K}"`
    : KeyHandler;
};

/**
 * Registers a single hotkey with the nearest `KeyboardProvider`.
 * Without a provider this hook is a no-op.
 */
export function useKey<S extends string>(
  hotkey: ValidateHotkey<S>,
  handler: KeyHandler,
  options?: UseKeyOptions,
): void;

/**
 * Registers several hotkeys with one handler through the nearest
 * `KeyboardProvider`.
 */
export function useKey<const Hotkeys extends readonly string[]>(
  hotkeys: { [K in keyof Hotkeys]: ValidateHotkey<Hotkeys[K]> },
  handler: KeyHandler,
  options?: UseKeyOptions,
): void;

/** Registers a map of hotkeys to handlers through the nearest `KeyboardProvider`. */
export function useKey<Handlers extends Record<string, KeyHandler>>(
  handlers: Handlers & ValidateHotkeyMap<Handlers>,
  options?: UseKeyOptions,
): void;

/** Implementation for the `useKey` overloads. */
export function useKey(
  first: string | readonly string[] | Record<string, KeyHandler>,
  second?: KeyHandler | UseKeyOptions,
  third?: UseKeyOptions,
): void {
  const { handlerMap, options } = normalizeKeyInput<UseKeyOptions>(first, second, third);

  const ctx = useOptionalKeyboardRegistryContext();
  const register = ctx?.register ?? null;
  const registerImplicit = ctx?.registerImplicit ?? null;
  const order = useId();

  const enabled = options?.enabled;
  const scope = options?.scope;
  const allowInInput = options?.allowInInput;
  const containerRef = options?.containerRef;
  const focusWithinOnly = options?.focusWithinOnly;
  const preventDefault = options?.preventDefault;

  const dispatch = useEffectEvent((key: string, event: KeyboardEvent) => handlerMap[key]?.(event));

  const registrationKeys = Object.keys(handlerMap).sort();
  // Length-prefixed so a hotkey containing the `|` delimiter cannot collide with a different key set.
  const registrationVersion = registrationKeys.map((key) => `${key.length}:${key}`).join("|");

  const handlerOptions: HandlerOptions | undefined = options
    ? {
        allowInInput,
        containerRef,
        focusWithinOnly,
        preventDefault,
      }
    : undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentionally the stable primitive options plus the derived `registrationVersion` string; depending on the per-render `handlerMap`/`registrationKeys`/`handlerOptions` objects would re-register on every render. Latest handlers are read via the stable `dispatch` effect event.
  useLayoutEffect(() => {
    if (enabled === false) return;
    if (scope === null) return;

    if (scope === undefined && !registerImplicit) return;
    if (scope !== undefined && !register) return;

    const cleanups = registrationKeys.map((key) => {
      const handler = (event: KeyboardEvent) => dispatch(key, event);
      return scope === undefined
        ? registerImplicit?.(order, key, handler, handlerOptions)
        : register?.(scope, key, handler, handlerOptions);
    });

    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
  }, [
    register,
    registerImplicit,
    scope,
    order,
    registrationVersion,
    enabled,
    allowInInput,
    containerRef,
    focusWithinOnly,
    preventDefault,
  ]);
}
