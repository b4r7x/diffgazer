"use client";

import { type RefObject, useEffectEvent, useLayoutEffect, useRef } from "react";
import {
  DEFAULT_OVERLAY_PRIORITY,
  disposeEscapeKeyLayer,
  disposeOutsideClickLayer,
  type ExcludeRefs,
  getOutsideClickDocuments,
  registerEscapeKeyLayer,
  registerOutsideClickLayer,
  type OutsideClickLayerHandle,
  updateOutsideClickLayer,
} from "./overlay-dismiss-stack";

/** Shared stack options for outside-pointer and Escape-key overlay dismissal. */
export interface OverlayStackOptions {
  /** Higher priority entries receive the dismiss event before lower priority entries. @default 1 */
  priority?: number;
  /** Element ref used for ownerDocument resolution and nested-overlay ordering. */
  ref?: RefObject<HTMLElement | null>;
  /** Additional refs treated as part of the overlay for dismissal and stack ordering. */
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
  /** Escape target matcher used to route a keypress to a specific overlay. */
  contains?: (target: Node | null) => boolean;
}

/**
 * Detects pointer presses outside a referenced element.
 *
 * @param ref Inside boundary for outside-pointer detection.
 * @param handler Called when the topmost enabled layer receives an outside press.
 * @param enabled Whether this layer participates in dismissal.
 * @param excludeRefs Additional inside boundaries for outside-pointer detection.
 * @param options Fifth positional argument for stack priority and nested-overlay ordering.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean = true,
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>,
  options?: OverlayStackOptions,
): void {
  const handleOutsideClick = useEffectEvent(handler);
  // Keep the latest excludeRefs without making it an effect dep, so an inline
  // array does not re-register (and reorder) the stack entry every render.
  const excludeRefsRef = useRef<ExcludeRefs>(excludeRefs);
  const entryRef = useRef<OutsideClickLayerHandle | null>(null);
  const priority = options?.priority ?? DEFAULT_OVERLAY_PRIORITY;

  // Latest-ref sync: inline boundary arrays must update every render without re-registering the stack entry.
  useLayoutEffect(() => {
    excludeRefsRef.current = excludeRefs;
    const node = enabled ? ref.current : null;
    const current = entryRef.current;

    if (current && (current.node !== node || current.priority !== priority)) {
      disposeOutsideClickLayer(current);
      entryRef.current = null;
    }

    if (!node) return;
    const ownerDocuments = getOutsideClickDocuments(node, excludeRefs);
    if (entryRef.current) {
      updateOutsideClickLayer(entryRef.current, {
        ref,
        handler: handleOutsideClick,
        ownerDocuments,
      });
      return;
    }

    entryRef.current = registerOutsideClickLayer({
      ref,
      node,
      handler: handleOutsideClick,
      excludeRefsRef,
      priority,
      ownerDocuments,
    });
  });

  useLayoutEffect(
    () => () => {
      const entry = entryRef.current;
      if (!entry) return;
      entryRef.current = null;
      disposeOutsideClickLayer(entry);
    },
    [],
  );
}

/** Registers an Escape-key dismissal handler in the shared overlay stack. */
export function useEscapeKey(
  handler: (event: KeyboardEvent) => void,
  enabled: boolean = true,
  options?: OverlayStackOptions,
): void {
  const handleEscape = useEffectEvent(handler);
  const optionsRef = options?.ref;
  const priority = options?.priority ?? DEFAULT_OVERLAY_PRIORITY;
  // Keep the latest excludeRefs off the effect deps (inline arrays/objects
  // otherwise re-register the stack entry on every render).
  const excludeRefsRef = useRef<ExcludeRefs>(options?.excludeRefs);
  const containsRef = useRef<((target: Node | null) => boolean) | undefined>(options?.contains);

  // Latest-ref sync: inline Escape options must update every render without re-registering the stack entry.
  useLayoutEffect(() => {
    excludeRefsRef.current = options?.excludeRefs;
    containsRef.current = options?.contains;
  });

  useLayoutEffect(() => {
    if (!enabled) return;
    const ownerDocument =
      optionsRef?.current?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
    if (!ownerDocument) return;
    const handle = registerEscapeKeyLayer({
      handler: handleEscape,
      ref: optionsRef,
      excludeRefsRef,
      containsRef,
      priority,
      ownerDocument,
    });

    return () => {
      disposeEscapeKeyLayer(handle);
    };
  }, [enabled, priority, optionsRef]);
}
