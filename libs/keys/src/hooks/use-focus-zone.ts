"use client";

import { type RefObject, useEffect, useEffectEvent, useRef, useState } from "react";
import { DECLINE } from "../core/normalize-key-input.js";
import { isEditableElement, isHTMLElement } from "../dom/element-guards.js";
import { containsActiveElement, getFirstFocusableElement, isFocusable } from "../dom/focusable.js";
import type { UseKeyOptions } from "./use-key.js";
import { useKey } from "./use-key.js";
import { useScope } from "./use-scope.js";

type ZoneTransition<T extends string> = (params: {
  zone: T;
  key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
}) => T | null;

/** Options for multi-zone focus management and inter-zone keyboard transitions. */
export interface UseFocusZoneOptions<T extends string> {
  /** The initial active zone when in uncontrolled mode. */
  initial: T;
  /** All available zone identifiers. */
  zones: readonly [T, ...T[]];
  /** Controlled zone value. When provided, the hook operates in controlled mode. */
  zone?: T;
  /** Called whenever the active zone changes. */
  onZoneChange?: (zone: T) => void;
  /** Called before focus leaves a zone. */
  onLeaveZone?: (zone: T) => void;
  /** Called when focus enters a zone. */
  onEnterZone?: (zone: T) => void;
  /** Custom arrow-key transition function; return a target zone or null to block. */
  transitions?: ZoneTransition<T>;
  /** Zone order for Tab/Shift+Tab cycling; omitted means native Tab behavior. */
  tabCycle?: readonly T[];
  /**
   * Where Tab/Shift+Tab cycling claims the Tab key. `"containers"` cycles only
   * while focus is inside a registered zone container and declines elsewhere so
   * native Tab proceeds (falling back to a document-wide cycle when no
   * containment is resolvable); `"document"` cycles from anywhere in the
   * document except editable targets, which keep native Tab.
   */
  tabCycleScope?: "containers" | "document";
  /**
   * In document scope, Tab is claimed only while focus is inside this element.
   * Outside it, native Tab proceeds. No effect when unset or null.
   */
  tabCycleBoundary?: FocusZoneTargetRef;
  /** Keyboard scope name to push while the focus zone is active; null skips registration. */
  scope?: string | null;
  /** Optional DOM subtree used to scope registered focus-zone keys. */
  containerRef?: UseKeyOptions["containerRef"];
  /** When true, focus-zone keys only run while focus is inside containerRef. */
  focusWithinOnly?: boolean;
  /** Whether focus-zone keys may run when an input-like element has focus. */
  allowInInput?: boolean;
  /** Default preventDefault behavior inherited by transition keys and key helpers. */
  preventDefault?: boolean;
  /** Whether the focus zone hook is active. */
  enabled?: boolean;
  /** Optional DOM focus targets for zone changes. */
  focus?: UseFocusZoneFocusOptions<T>;
}

/** DOM attributes for a zone container. */
export interface FocusZoneProps {
  /** Present when the zone is active. */
  "data-focused": true | undefined;
}

/** Ref-like value that resolves to a zone container or target element. */
export type FocusZoneTargetRef = RefObject<HTMLElement | null> | (() => HTMLElement | null);

/**
 * Focus target for a zone: a single ref/getter, or a container plus optional
 * inner target that avoids focus repair while focus remains inside the container.
 */
export type FocusZoneTarget =
  | FocusZoneTargetRef
  | {
      /** Container used for containment checks and focus-zone synchronization. */
      container: FocusZoneTargetRef;
      /** Specific element to focus when the zone becomes active. */
      target?: FocusZoneTargetRef;
    };

/** DOM focus behavior for `useFocusZone`. */
export interface UseFocusZoneFocusOptions<T extends string> {
  /** Focus target configuration keyed by zone name. */
  targets: Partial<Record<T, FocusZoneTarget>>;
  /** Whether the initial zone should receive focus on mount. */
  autoFocus?: boolean;
  /** Pass `preventScroll` when moving focus to a zone target. */
  preventScroll?: boolean;
}

/** Return value from `useFocusZone`. */
export interface UseFocusZoneReturn<T extends string> {
  /** The currently active zone. */
  zone: T;
  /** Imperatively set the active zone. */
  setZone: (zone: T) => void;
  /** Returns true if the current zone matches any provided zone. */
  isZone: (...zones: T[]) => boolean;
  /** Returns `UseKeyOptions` scoped to one zone, merged with optional extras. */
  getKeyOptions: (zone: T, extra?: UseKeyOptions) => UseKeyOptions;
  /** Returns DOM attributes for a zone's container element. */
  getZoneProps: (zone: T) => FocusZoneProps;
}

const ARROW_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const;

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

/**
 * Models a layout as named zones, routes arrow or Tab transitions between them,
 * and optionally moves DOM focus to the active zone target.
 */
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
    tabCycleScope = "containers",
    tabCycleBoundary,
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

  const validatedTabCycle = tabCycle?.filter((entry) => zones.includes(entry));

  const canCycleTabs = enabled && validatedTabCycle != null && validatedTabCycle.length > 1;

  const setZoneValue = (next: T) => {
    if (next === currentZone) return;
    if (!zones.includes(next)) return;
    onLeaveZone?.(currentZone);
    onEnterZone?.(next);
    if (controlledZone === undefined) setInternalZone(next);
    onZoneChange?.(next);
  };

  const handleArrowTransition = (key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown") => {
    const next = transitions?.({ zone: currentZone, key });
    if (next != null && zones.includes(next)) {
      setZoneValue(next);
      return;
    }
    return DECLINE;
  };

  const cycleZone = (delta: 1 | -1) => {
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
  };

  useKey(ARROW_KEYS, (e) => handleArrowTransition(e.key as (typeof ARROW_KEYS)[number]), {
    enabled: enabled && transitions != null,
    scope,
    containerRef,
    focusWithinOnly,
    allowInInput,
    preventDefault,
  });

  // Resolve every container that anchors this focus zone (per-zone focus targets
  // plus an explicit containerRef). Returns null when no containment is
  // resolvable, in which case Tab keeps its legacy document-wide cycle.
  const getTabContainers = useEffectEvent((): HTMLElement[] | null => {
    const containers: HTMLElement[] = [];
    if (focus) {
      for (const zone of zones) {
        const { container } = resolveFocusTarget(focus.targets[zone]);
        if (container) containers.push(container);
      }
    }
    const explicit = containerRef?.current;
    if (explicit) containers.push(explicit);
    return containers.length > 0 ? containers : null;
  });

  const handleTabCycle = useEffectEvent((delta: 1 | -1, event: KeyboardEvent) => {
    const target = event.composedPath()[0] ?? event.target;
    if (tabCycleScope === "document") {
      // Editable targets keep native Tab even when allowInInput lets keys through.
      if (isEditableElement(target)) return DECLINE;
      const boundary = resolveFocusTargetRef(tabCycleBoundary);
      if (boundary) {
        const insideBoundary =
          (isHTMLElement(target) && boundary.contains(target)) ||
          containsActiveElement(boundary);
        if (!insideBoundary) return DECLINE;
      }
    } else {
      const containers = getTabContainers();
      if (containers) {
        const inside = containers.some(
          (container) =>
            (isHTMLElement(target) && container.contains(target)) ||
            containsActiveElement(container),
        );
        // Outside every container: decline so native Tab proceeds (no preventDefault).
        if (!inside) return DECLINE;
      }
    }
    event.preventDefault();
    cycleZone(delta);
    return undefined;
  });

  useKey("Tab", (event) => handleTabCycle(1, event), {
    enabled: canCycleTabs,
    scope,
    containerRef,
    focusWithinOnly,
    allowInInput,
  });

  useKey("shift+Tab", (event) => handleTabCycle(-1, event), {
    enabled: canCycleTabs,
    scope,
    containerRef,
    focusWithinOnly,
    allowInInput,
  });

  const hasExplicitScope = "scope" in options;
  useScope(hasExplicitScope ? (scope ?? null) : null, {
    enabled: enabled && hasExplicitScope && scope != null,
  });

  const hasFocusTargets = focus != null;

  const syncZoneFromFocusTarget = useEffectEvent((target: HTMLElement) => {
    if (!focus) return;
    for (const zone of zones) {
      const { container } = resolveFocusTarget(focus.targets[zone]);
      if (container?.contains(target)) {
        setZoneValue(zone);
        return;
      }
    }
  });

  const attachedFocusinDocsRef = useRef(new Map<Document, (event: FocusEvent) => void>());

  // The listener set is reconciled when the resolvable document set actually
  // changes (e.g. a cross-document target mounts late). A keystroke never changes
  // that set, so the listener is not churned per keypress; per-event container
  // resolution lives in `syncZoneFromFocusTarget`.
  const reconcileFocusinListeners = useEffectEvent(() => {
    const attached = attachedFocusinDocsRef.current;
    if (!enabled || !focus) {
      for (const [doc, handler] of attached) doc.removeEventListener("focusin", handler);
      attached.clear();
      return;
    }

    const docs = new Set<Document>();
    for (const zone of zones) {
      const { container } = resolveFocusTarget(focus.targets[zone]);
      if (container) docs.add(container.ownerDocument);
    }
    if (docs.size === 0 && typeof document !== "undefined") {
      docs.add(document);
    }

    for (const [doc, handler] of attached) {
      if (!docs.has(doc)) {
        doc.removeEventListener("focusin", handler);
        attached.delete(doc);
      }
    }
    for (const doc of docs) {
      if (attached.has(doc)) continue;
      const handler = (event: FocusEvent) => {
        const target = event.target;
        if (!isHTMLElement(target)) return;
        syncZoneFromFocusTarget(target);
      };
      doc.addEventListener("focusin", handler);
      attached.set(doc, handler);
    }
  });

  useEffect(() => {
    reconcileFocusinListeners();
  });

  useEffect(() => {
    const attached = attachedFocusinDocsRef.current;
    return () => {
      for (const [doc, handler] of attached) doc.removeEventListener("focusin", handler);
      attached.clear();
    };
  }, []);

  const safeZone = zones.includes(currentZone) ? currentZone : zones[0];

  const repairZoneFocus = useEffectEvent((zone: T) => {
    if (!focus) return;
    const { container, target } = resolveFocusTarget(focus.targets[zone]);
    if (!target) return;
    if (container && containsActiveElement(container)) return;

    const focusTarget = resolveFocusableTarget(target);
    if (!focusTarget) return;

    focusTarget.focus({ preventScroll: focus.preventScroll ?? true });
  });

  const shouldAutoFocusInitial = useEffectEvent(() => focus?.autoFocus ?? false);

  useEffect(() => {
    const previousZone = lastFocusedZoneRef.current;
    if (!enabled || !hasFocusTargets) return;
    if (previousZone === safeZone) return;
    if (previousZone === null && !shouldAutoFocusInitial()) {
      lastFocusedZoneRef.current = safeZone;
      return;
    }

    repairZoneFocus(safeZone);
    lastFocusedZoneRef.current = safeZone;
  }, [enabled, hasFocusTargets, safeZone]);

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
