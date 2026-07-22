import { useEffectEvent } from "react";
import { DECLINE } from "../../core/normalize-key-input.js";
import {
  getComposedEventTarget,
  isEditableElement,
  isHTMLElement,
} from "../../dom/element-guards.js";
import { containsActiveElement } from "../../dom/focusable.js";
import { useKey } from "../use-key.js";
import { useScope } from "../use-scope.js";
import { resolveFocusTarget, resolveFocusTargetRef } from "./focus-sync.js";
import { ARROW_KEYS, type UseFocusZoneOptions } from "./types.js";

export function useFocusZoneKeyboard<T extends string>(
  options: Pick<
    UseFocusZoneOptions<T>,
    | "transitions"
    | "tabCycleScope"
    | "tabCycleBoundary"
    | "scope"
    | "containerRef"
    | "focusWithinOnly"
    | "allowInInput"
    | "preventDefault"
    | "enabled"
    | "focus"
  >,
  state: {
    currentZone: T;
    zones: readonly [T, ...T[]];
    setZoneValue: (next: T) => void;
    validatedTabCycle: T[] | undefined;
    canCycleTabs: boolean;
    enabled: boolean;
  },
  scopeOptions: UseFocusZoneOptions<T>,
) {
  const {
    transitions,
    tabCycleScope = "containers",
    tabCycleBoundary,
    scope,
    containerRef,
    focusWithinOnly,
    allowInInput,
    preventDefault,
    focus,
  } = options;

  const { currentZone, zones, setZoneValue, validatedTabCycle, canCycleTabs, enabled } = state;

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
    const target = getComposedEventTarget(event);
    if (tabCycleScope === "document") {
      if (isEditableElement(target)) return DECLINE;
      const boundary = resolveFocusTargetRef(tabCycleBoundary);
      if (boundary) {
        const insideBoundary =
          (isHTMLElement(target) && boundary.contains(target)) || containsActiveElement(boundary);
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

  const hasExplicitScope = "scope" in scopeOptions;
  useScope(hasExplicitScope ? (scope ?? null) : null, {
    enabled: enabled && hasExplicitScope && scope != null,
  });
}
