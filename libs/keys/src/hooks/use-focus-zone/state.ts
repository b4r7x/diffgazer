import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { UseFocusZoneOptions } from "./types.js";

export function useFocusZoneState<T extends string>(
  options: Pick<
    UseFocusZoneOptions<T>,
    "initial" | "zones" | "zone" | "onZoneChange" | "onLeaveZone" | "onEnterZone" | "tabCycle" | "enabled"
  >,
) {
  const { initial, zones, enabled = true } = options;
  const { zone: controlledZone, onZoneChange, onLeaveZone, onEnterZone, tabCycle } = options;

  const [internalZone, setInternalZone] = useState<T>(initial);

  const currentZone: T = controlledZone ?? internalZone;
  const lastFocusedZoneRef = useRef<T | null>(null);
  const zoneStateRef = useRef({
    currentZone,
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
      currentZone,
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
    if (next === latest.currentZone) return;
    if (!latest.zones.includes(next)) return;
    latest.onLeaveZone?.(latest.currentZone);
    latest.onEnterZone?.(next);
    if (latest.controlledZone === undefined) setInternalZone(next);
    latest.onZoneChange?.(next);
  }, []);

  const safeZone = zones.includes(currentZone) ? currentZone : zones[0];

  return {
    currentZone,
    safeZone,
    setZoneValue,
    validatedTabCycle,
    canCycleTabs,
    zones,
    enabled,
    lastFocusedZoneRef,
  };
}
