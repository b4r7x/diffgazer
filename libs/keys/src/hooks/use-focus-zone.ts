import { useState, useEffectEvent } from "react";
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

  const [internalZone, setInternalZone] = useState<T>(initial);

  const currentZone: T = options.zone ?? internalZone;

  const setZoneValue = useEffectEvent((next: T) => {
    if (next === currentZone) return;
    options.onLeaveZone?.(currentZone);
    options.onEnterZone?.(next);
    if (options.zone === undefined) setInternalZone(next);
    options.onZoneChange?.(next);
  });

  const stableTransitions = useEffectEvent(
    (key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown") => {
      const next = options.transitions?.({ zone: currentZone, key });
      if (next != null && zones.includes(next)) {
        setZoneValue(next);
      }
    },
  );

  const cycleZone = useEffectEvent((delta: 1 | -1) => {
    if (!options.tabCycle || options.tabCycle.length === 0) return;
    const cycle = options.tabCycle;
    const idx = cycle.indexOf(currentZone);
    const next = cycle[(idx + delta + cycle.length) % cycle.length] ?? cycle[0];
    if (!next) return;
    setZoneValue(next);
  });

  useKey(
    keys(ARROW_KEYS, (e) => stableTransitions(e.key as typeof ARROW_KEYS[number])),
    { enabled: enabled && options.transitions != null },
  );

  useKey("Tab", () => cycleZone(1), {
    enabled: enabled && options.tabCycle != null,
    preventDefault: true,
  });

  useKey("shift+Tab", () => cycleZone(-1), {
    enabled: enabled && options.tabCycle != null,
    preventDefault: true,
  });

  useScope(options.scope ?? null, { enabled: enabled && !!options.scope });

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
