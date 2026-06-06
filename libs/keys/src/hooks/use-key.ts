"use client";

import type { RefObject } from "react";
import { useEffectEvent, useId, useLayoutEffect } from "react";
import type { KeyHandler } from "../core/normalize-key-input.js";
import { normalizeKeyInput } from "../core/normalize-key-input.js";
import type { HandlerOptions } from "../providers/keyboard.js";
import { useOptionalKeyboardRegistryContext } from "../providers/keyboard-context.js";

export interface UseKeyOptions {
  enabled?: boolean;
  scope?: string | null;
  allowInInput?: boolean;
  containerRef?: RefObject<HTMLElement | null>;
  focusWithinOnly?: boolean;
  preventDefault?: boolean;
}

export function useKey(
  hotkey: string,
  handler: KeyHandler,
  options?: UseKeyOptions,
): void;

export function useKey(
  hotkeys: readonly string[],
  handler: KeyHandler,
  options?: UseKeyOptions,
): void;

export function useKey(
  handlers: Record<string, KeyHandler>,
  options?: UseKeyOptions,
): void;

export function useKey(
  first: string | readonly string[] | Record<string, KeyHandler>,
  second?: KeyHandler | UseKeyOptions,
  third?: UseKeyOptions,
): void {
  const { handlerMap, options } = normalizeKeyInput<UseKeyOptions>(first, second, third);

  const ctx = useOptionalKeyboardRegistryContext();
  const register = ctx?.register ?? null;
  const getScopeForOrder = ctx?.getScopeForOrder ?? null;
  const order = useId();

  const enabled = options?.enabled;
  const scope = options?.scope;
  const allowInInput = options?.allowInInput;
  const containerRef = options?.containerRef;
  const focusWithinOnly = options?.focusWithinOnly;
  const preventDefault = options?.preventDefault;

  const dispatch = useEffectEvent((key: string, event: KeyboardEvent) => (
    handlerMap[key]?.(event)
  ));

  const registrationKeys = Object.keys(handlerMap).sort();
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
    if (!register) return;
    if (scope === null) return;

    const registrationScope = scope ?? getScopeForOrder?.(order) ?? null;
    if (registrationScope === null) return;

    const cleanups = registrationKeys.map((key) =>
      register(
        registrationScope,
        key,
        (event: KeyboardEvent) => dispatch(key, event),
        handlerOptions,
      ),
    );

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [
    register,
    getScopeForOrder,
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
