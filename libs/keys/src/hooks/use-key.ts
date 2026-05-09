"use client";

import { useEffect, useEffectEvent } from "react";
import type { RefObject } from "react";
import type { HandlerOptions } from "../providers/keyboard-provider.js";
import { useOptionalKeyboardRegistryContext } from "../context/keyboard-context.js";
import type { KeyHandler } from "../internal/normalize-key-input.js";
import { normalizeKeyInput } from "../internal/normalize-key-input.js";

export interface UseKeyOptions {
  enabled?: boolean;
  scope?: string;
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
  const getActiveScope = ctx?.getActiveScope ?? null;

  const enabled = options?.enabled;
  const scope = options?.scope;
  const allowInInput = options?.allowInInput;
  const containerRef = options?.containerRef;
  const focusWithinOnly = options?.focusWithinOnly;
  const preventDefault = options?.preventDefault;

  const dispatch = useEffectEvent((key: string, event: KeyboardEvent) => {
    handlerMap[key]?.(event);
  });

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

  useEffect(() => {
    if (enabled === false) return;
    if (!register || !getActiveScope) return;

    const registrationScope = scope ?? getActiveScope();
    if (registrationScope === null) return;

    const cleanups = registrationKeys.map((key) =>
      register(
        registrationScope,
        key,
        (event: KeyboardEvent) => dispatch(key, event),
        handlerOptions,
      ),
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    register,
    getActiveScope,
    scope,
    registrationVersion,
    enabled,
    allowInInput,
    containerRef,
    focusWithinOnly,
    preventDefault,
  ]);
}
