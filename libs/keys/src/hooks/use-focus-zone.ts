"use client";

import { useFocusZoneFocusSync } from "./use-focus-zone/focus-sync.js";
import { useFocusZoneKeyboard } from "./use-focus-zone/keyboard.js";
import { useFocusZoneState } from "./use-focus-zone/state.js";
import type {
  FocusZoneProps,
  UseFocusZoneOptions,
  UseFocusZoneReturn,
} from "./use-focus-zone/types.js";
import type { UseKeyOptions } from "./use-key.js";

export type {
  FocusZoneProps,
  FocusZoneTarget,
  FocusZoneTargetRef,
  UseFocusZoneFocusOptions,
  UseFocusZoneOptions,
  UseFocusZoneReturn,
} from "./use-focus-zone/types.js";

/**
 * Models a layout as named zones, routes arrow or Tab transitions between them,
 * and optionally moves DOM focus to the active zone target.
 */
export function useFocusZone<T extends string>(
  options: UseFocusZoneOptions<T>,
): UseFocusZoneReturn<T> {
  const { scope, containerRef, focusWithinOnly, allowInInput, preventDefault, focus } = options;

  const state = useFocusZoneState(options);
  const {
    safeZone,
    setZoneValue,
    validatedTabCycle,
    canCycleTabs,
    zones,
    enabled,
    lastFocusedZoneRef,
  } = state;

  useFocusZoneKeyboard(options, {
    safeZone,
    zones,
    setZoneValue,
    validatedTabCycle,
    canCycleTabs,
    enabled,
  });

  useFocusZoneFocusSync({
    zones,
    safeZone,
    setZoneValue,
    enabled,
    focus,
    lastFocusedZoneRef,
  });

  const isZone = (...matchZones: T[]) => matchZones.includes(safeZone);
  const getKeyOptions = (zone: T, extra?: UseKeyOptions): UseKeyOptions => ({
    containerRef,
    focusWithinOnly,
    allowInInput,
    preventDefault,
    ...extra,
    scope: extra?.scope ?? scope,
    enabled: enabled && safeZone === zone && (extra?.enabled ?? true),
  });
  const getZoneProps = (zone: T): FocusZoneProps => ({
    "data-focused": safeZone === zone || undefined,
  });

  return {
    zone: safeZone,
    setZone: setZoneValue,
    isZone,
    getKeyOptions,
    getZoneProps,
  };
}
