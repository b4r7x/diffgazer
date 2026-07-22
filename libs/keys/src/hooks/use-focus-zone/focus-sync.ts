import { type RefObject, useEffect, useEffectEvent, useRef } from "react";
import {
  composedContains,
  getComposedEventTarget,
  isHTMLElement,
} from "../../dom/element-guards.js";
import { containsActiveElement, getFirstFocusableElement, isFocusable } from "../../dom/focusable.js";
import type { FocusZoneTarget, FocusZoneTargetRef, UseFocusZoneFocusOptions } from "./types.js";

export function resolveFocusTargetRef(ref: FocusZoneTargetRef | undefined): HTMLElement | null {
  if (!ref) return null;
  if (typeof ref === "function") return ref();
  return ref.current;
}

export function resolveFocusTarget(entry: FocusZoneTarget | undefined): {
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

export function resolveFocusableTarget(target: HTMLElement): HTMLElement | null {
  if (isFocusable(target)) return target;
  return getFirstFocusableElement(target);
}

export function useFocusZoneFocusSync<T extends string>(params: {
  zones: readonly [T, ...T[]];
  safeZone: T;
  setZoneValue: (next: T) => void;
  enabled: boolean;
  focus: UseFocusZoneFocusOptions<T> | undefined;
  lastFocusedZoneRef: RefObject<T | null>;
}) {
  const { zones, safeZone, setZoneValue, enabled, focus, lastFocusedZoneRef } = params;

  const hasFocusTargets = focus != null;

  const syncZoneFromFocusTarget = useEffectEvent((target: HTMLElement) => {
    if (!focus) return;
    for (const zone of zones) {
      const { container } = resolveFocusTarget(focus.targets[zone]);
      if (container && composedContains(container, target)) {
        setZoneValue(zone);
        return;
      }
    }
  });

  const attachedFocusinDocsRef = useRef(new Map<Document, (event: FocusEvent) => void>());

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
        const target = getComposedEventTarget(event);
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
}
