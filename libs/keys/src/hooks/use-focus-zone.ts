"use client";

import { useCallback, useState } from "react";
import { useKey } from "./use-key.js";
import type { UseKeyOptions } from "./use-key.js";
import { useScope } from "./use-scope.js";
import { keys } from "../utils/keys.js";

type ZoneTransition<T extends string> = (params: {
  zone: T;
  key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
}) => T | null;

interface UseFocusZoneOptions<T extends string> {
  initial: T;
  zones: readonly [T, ...T[]];
  zone?: T;
  onZoneChange?: (zone: T) => void;
  onLeaveZone?: (zone: T) => void;
  onEnterZone?: (zone: T) => void;
  transitions?: ZoneTransition<T>;
  tabCycle?: readonly T[];
  scope?: string;
  enabled?: boolean;
}

export interface ZoneProps {
  "data-focused": true | undefined;
}

interface UseFocusZoneReturn<T extends string> {
  zone: T;
  setZone: (zone: T) => void;
  inZone: (...zones: T[]) => boolean;
  forZone: (target: T, extra?: UseKeyOptions) => UseKeyOptions;
  zoneProps: (target: T) => ZoneProps;
}

const ARROW_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
] as const;

export function useFocusZone<T extends string>(
  options: UseFocusZoneOptions<T>,
): UseFocusZoneReturn<T> {
  const { initial, zones, enabled = true } = options;
  const {
    zone: controlledZone,
    onZoneChange,
    onLeaveZone,
    onEnterZone,
    transitions,
    tabCycle,
    scope,
  } = options;

  const [internalZone, setInternalZone] = useState<T>(initial);

  const currentZone: T = controlledZone ?? internalZone;

  const setZoneValue = useCallback((next: T) => {
    if (next === currentZone) return;
    onLeaveZone?.(currentZone);
    onEnterZone?.(next);
    if (controlledZone === undefined) setInternalZone(next);
    onZoneChange?.(next);
  }, [controlledZone, currentZone, onEnterZone, onLeaveZone, onZoneChange]);

  const stableTransitions = useCallback(
    (key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown") => {
      const next = transitions?.({ zone: currentZone, key });
      if (next != null && zones.includes(next)) {
        setZoneValue(next);
      }
    },
    [currentZone, setZoneValue, transitions, zones],
  );

  const cycleZone = useCallback((delta: 1 | -1) => {
    if (!tabCycle || tabCycle.length === 0) return;
    const cycle = tabCycle;
    const idx = cycle.indexOf(currentZone);
    const next = cycle[(idx + delta + cycle.length) % cycle.length] ?? cycle[0];
    if (!next) return;
    setZoneValue(next);
  }, [currentZone, setZoneValue, tabCycle]);

  useKey(
    keys(ARROW_KEYS, (e) => stableTransitions(e.key as typeof ARROW_KEYS[number])),
    { enabled: enabled && transitions != null },
  );

  useKey("Tab", () => cycleZone(1), {
    enabled: enabled && tabCycle != null,
    preventDefault: true,
  });

  useKey("shift+Tab", () => cycleZone(-1), {
    enabled: enabled && tabCycle != null,
    preventDefault: true,
  });

  useScope(scope ?? null, { enabled: enabled && !!scope });

  const safeZone = zones.includes(currentZone) ? currentZone : zones[0];

  return {
    zone: safeZone,
    setZone: setZoneValue,
    inZone: (...zones: T[]) => zones.includes(safeZone),
    forZone: (target: T, extra?: UseKeyOptions): UseKeyOptions => ({
      ...extra,
      enabled: safeZone === target && (extra?.enabled ?? true),
    }),
    zoneProps: (target: T): ZoneProps => ({
      "data-focused": safeZone === target || undefined,
    }),
  };
}
