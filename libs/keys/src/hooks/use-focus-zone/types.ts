import type { RefObject } from "react";
import type { UseKeyOptions } from "../use-key.js";

export type ZoneTransition<T extends string> = (params: {
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

export const ARROW_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const;
