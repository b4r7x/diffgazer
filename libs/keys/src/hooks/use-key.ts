import { useEffect, useEffectEvent } from "react";
import type { RefObject } from "react";
import type { HandlerOptions } from "../providers/keyboard-provider.js";
import { useOptionalKeyboardContext } from "../context/keyboard-context.js";
import type { KeyHandler } from "../internal/normalize-key-input.js";
import { normalizeKeyInput } from "../internal/normalize-key-input.js";

export interface UseKeyOptions {
  enabled?: boolean;
  allowInInput?: boolean;
  targetRef?: RefObject<HTMLElement | null>;
  requireFocusWithin?: boolean;
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

  const ctx = useOptionalKeyboardContext();
  const register = ctx?.register ?? null;
  const activeScope = ctx?.activeScope ?? null;

  const enabled = options?.enabled;
  const allowInInput = options?.allowInInput;
  const targetRef = options?.targetRef;
  const requireFocusWithin = options?.requireFocusWithin;
  const preventDefault = options?.preventDefault;

  const stableDispatch = useEffectEvent((key: string, event: KeyboardEvent) => {
    handlerMap[key]?.(event);
  });

  const keysKey = Object.keys(handlerMap).sort().join(",");

  const handlerOptions: HandlerOptions | undefined = options
    ? {
        allowInInput,
        targetRef,
        requireFocusWithin,
        preventDefault,
      }
    : undefined;

  useEffect(() => {
    if (enabled === false) return;
    if (!register || !activeScope) return;

    const keys = keysKey.split(",");
    const cleanups = keys.map((key) =>
      register(
        activeScope,
        key,
        (event: KeyboardEvent) => stableDispatch(key, event),
        handlerOptions,
      ),
    );

    return () => cleanups.forEach((cleanup) => cleanup());
    // register is useEffectEvent-based (stable reference), excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeScope,
    keysKey,
    enabled,
    allowInInput,
    targetRef,
    requireFocusWithin,
    preventDefault,
  ]);
}
