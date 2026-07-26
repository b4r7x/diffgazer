import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { UseFocusZoneOptions } from "./types.js";

export function useFocusZoneState<T extends string>(
  options: Pick<
    UseFocusZoneOptions<T>,
    | "initial"
    | "zones"
    | "zone"
    | "onZoneChange"
    | "onLeaveZone"
    | "onEnterZone"
    | "tabCycle"
    | "enabled"
  >,
) {
  const { initial, zones, enabled = true } = options;
  const { zone: controlledZone, onZoneChange, onLeaveZone, onEnterZone, tabCycle } = options;

  const [internalZone, setInternalZone] = useState<T>(initial);

  // `initial` and a controlled `zone` are consumer-supplied and can point outside
  // `zones`; validate once here so every consumer reads the same active zone.
  const requestedZone: T = controlledZone ?? internalZone;
  const safeZone = zones.includes(requestedZone) ? requestedZone : zones[0];

  const lastFocusedZoneRef = useRef<T | null>(null);
  const zoneStateRef = useRef({
    safeZone,
    zones,
    controlledZone,
    onLeaveZone,
    onEnterZone,
    onZoneChange,
  });
  // Latest-ref sync: the public setter is called from consumer event handlers,
  // where useEffectEvent is forbidden; runs every render by design.
  useLayoutEffect(() => {
    zoneStateRef.current = {
      safeZone,
      zones,
      controlledZone,
      onLeaveZone,
      onEnterZone,
      onZoneChange,
    };
  });

  const validatedTabCycle = tabCycle?.filter((entry) => zones.includes(entry));

  const canCycleTabs = enabled && validatedTabCycle != null && validatedTabCycle.length > 1;

  const setZoneValue = useCallback((next: T) => {
    const latest = zoneStateRef.current;
    if (next === latest.safeZone) return;
    if (!latest.zones.includes(next)) return;
    latest.onLeaveZone?.(latest.safeZone);
    latest.onEnterZone?.(next);
    if (latest.controlledZone === undefined) setInternalZone(next);
    latest.onZoneChange?.(next);
  }, []);

  return {
    safeZone,
    setZoneValue,
    validatedTabCycle,
    canCycleTabs,
    zones,
    enabled,
    lastFocusedZoneRef,
  };
}
