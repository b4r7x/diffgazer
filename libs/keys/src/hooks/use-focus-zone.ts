"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useKey } from "./use-key.js";
import type { UseKeyOptions } from "./use-key.js";
import { useScope } from "./use-scope.js";
import { DECLINE } from "../core/normalize-key-input.js";
import { isHTMLElement } from "../dom/dom.js";
import { containsActiveElement, getFirstFocusableElement, isFocusable } from "../dom/focusable.js";

type ZoneTransition<T extends string> = (params: {
  zone: T;
  key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
}) => T | null;

export interface UseFocusZoneOptions<T extends string> {
  initial: T;
  zones: readonly [T, ...T[]];
  zone?: T;
  onZoneChange?: (zone: T) => void;
  onLeaveZone?: (zone: T) => void;
  onEnterZone?: (zone: T) => void;
  transitions?: ZoneTransition<T>;
  tabCycle?: readonly T[];
  scope?: string | null;
  containerRef?: UseKeyOptions["containerRef"];
  focusWithinOnly?: boolean;
  allowInInput?: boolean;
  preventDefault?: boolean;
  enabled?: boolean;
  focus?: UseFocusZoneFocusOptions<T>;
}

export interface FocusZoneProps {
  "data-focused": true | undefined;
}

export type FocusZoneTargetRef = RefObject<HTMLElement | null> | (() => HTMLElement | null);

export type FocusZoneTarget =
  | FocusZoneTargetRef
  | {
      container: FocusZoneTargetRef;
      target?: FocusZoneTargetRef;
    };

export interface UseFocusZoneFocusOptions<T extends string> {
  targets: Partial<Record<T, FocusZoneTarget>>;
  autoFocus?: boolean;
  preventScroll?: boolean;
}

export interface UseFocusZoneReturn<T extends string> {
  zone: T;
  setZone: (zone: T) => void;
  isZone: (...zones: T[]) => boolean;
  getKeyOptions: (zone: T, extra?: UseKeyOptions) => UseKeyOptions;
  getZoneProps: (zone: T) => FocusZoneProps;
}

const ARROW_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
] as const;

function resolveFocusTargetRef(ref: FocusZoneTargetRef | undefined): HTMLElement | null {
  if (!ref) return null;
  if (typeof ref === "function") return ref();
  return ref.current;
}

function resolveFocusTarget(entry: FocusZoneTarget | undefined): {
  container: HTMLElement | null;
  target: HTMLElement | null;
} {
  if (!entry) return { container: null, target: null };
  if (typeof entry === "object" && "container" in entry) {
    const container = resolveFocusTargetRef(entry.container);
    return {
      container,
      target: resolveFocusTargetRef(entry.target) ?? container,
    };
  }

  const target = resolveFocusTargetRef(entry);
  return { container: target, target };
}

function resolveFocusableTarget(target: HTMLElement): HTMLElement | null {
  if (isFocusable(target)) return target;
  return getFirstFocusableElement(target);
}

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
    containerRef,
    focusWithinOnly,
    allowInInput,
    preventDefault,
    focus,
  } = options;

  const [internalZone, setInternalZone] = useState<T>(initial);

  const currentZone: T = controlledZone ?? internalZone;
  const lastFocusedZoneRef = useRef<T | null>(null);
  const warnedTabCycleEntriesRef = useRef<Set<string>>(new Set());

  const validatedTabCycle = tabCycle?.filter((entry) => {
    const valid = zones.includes(entry);
    if (!valid && process.env.NODE_ENV !== "production") {
      const key = String(entry);
      if (!warnedTabCycleEntriesRef.current.has(key)) {
        warnedTabCycleEntriesRef.current.add(key);
        console.warn(
          `[@diffgazer/keys] useFocusZone: tabCycle entry "${key}" is not in zones`,
        );
      }
    }
    return valid;
  });

  const canCycleTabs = enabled && validatedTabCycle != null && validatedTabCycle.length > 1;

  const setZoneValue = useCallback((next: T) => {
    if (next === currentZone) return;
    if (!zones.includes(next)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[@diffgazer/keys] useFocusZone: setZone called with unknown zone "${String(next)}"`,
        );
      }
      return;
    }
    onLeaveZone?.(currentZone);
    onEnterZone?.(next);
    if (controlledZone === undefined) setInternalZone(next);
    onZoneChange?.(next);
  }, [controlledZone, currentZone, onEnterZone, onLeaveZone, onZoneChange, zones]);

  const stableTransitions = useCallback(
    (key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown") => {
      const next = transitions?.({ zone: currentZone, key });
      if (next != null && zones.includes(next)) {
        setZoneValue(next);
        return;
      }
      return DECLINE;
    },
    [currentZone, setZoneValue, transitions, zones],
  );

  const cycleZone = useCallback((delta: 1 | -1) => {
    if (!validatedTabCycle || validatedTabCycle.length === 0) return;
    const cycle = validatedTabCycle;
    const idx = cycle.indexOf(currentZone);
    if (idx === -1) {
      // Current zone is not part of the cycle; Tab enters the cycle from either end.
      const next = delta > 0 ? cycle[0] : cycle[cycle.length - 1];
      if (next) setZoneValue(next);
      return;
    }
    const next = cycle[(idx + delta + cycle.length) % cycle.length] ?? cycle[0];
    if (!next) return;
    setZoneValue(next);
  }, [currentZone, setZoneValue, validatedTabCycle]);

  useKey(
    ARROW_KEYS,
    (e) => stableTransitions(e.key as typeof ARROW_KEYS[number]),
    {
      enabled: enabled && transitions != null,
      scope,
      containerRef,
      focusWithinOnly,
      allowInInput,
      preventDefault,
    },
  );

  useKey("Tab", () => cycleZone(1), {
    enabled: canCycleTabs,
    preventDefault: true,
    scope,
    containerRef,
    focusWithinOnly,
    allowInInput,
  });

  useKey("shift+Tab", () => cycleZone(-1), {
    enabled: canCycleTabs,
    preventDefault: true,
    scope,
    containerRef,
    focusWithinOnly,
    allowInInput,
  });

  useScope(scope ?? null, { enabled: enabled && !!scope });

  useEffect(() => {
    if (!enabled || !focus) return;
    const targets = focus.targets;
    const docs = new Set<Document>();

    for (const zone of zones as readonly T[]) {
      const { container } = resolveFocusTarget(targets[zone]);
      if (container) docs.add(container.ownerDocument);
    }

    if (docs.size === 0 && typeof document !== "undefined") {
      docs.add(document);
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!isHTMLElement(target)) return;
      for (const zone of zones as readonly T[]) {
        const { container } = resolveFocusTarget(targets[zone]);
        if (container && container.contains(target)) {
          setZoneValue(zone);
          return;
        }
      }
    }

    docs.forEach((doc) => doc.addEventListener("focusin", handleFocusIn));
    return () => docs.forEach((doc) => doc.removeEventListener("focusin", handleFocusIn));
  }, [enabled, focus, zones, setZoneValue]);

  const safeZone = zones.includes(currentZone) ? currentZone : zones[0];

  useEffect(() => {
    const previousZone = lastFocusedZoneRef.current;
    if (!enabled || !focus) return;
    if (previousZone === safeZone) return;
    if (previousZone === null && !focus.autoFocus) {
      lastFocusedZoneRef.current = safeZone;
      return;
    }

    const { container, target } = resolveFocusTarget(focus.targets[safeZone]);
    if (!target) {
      lastFocusedZoneRef.current = safeZone;
      return;
    }
    if (container && containsActiveElement(container)) {
      lastFocusedZoneRef.current = safeZone;
      return;
    }

    const focusTarget = resolveFocusableTarget(target);
    if (!focusTarget) {
      lastFocusedZoneRef.current = safeZone;
      return;
    }

    focusTarget.focus({ preventScroll: focus.preventScroll ?? true });
    lastFocusedZoneRef.current = safeZone;
  }, [enabled, focus, safeZone]);

  const isZone = (...zones: T[]) => zones.includes(safeZone);
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
