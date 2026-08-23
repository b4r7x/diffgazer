import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { DECLINE, getRestorableFocusTarget, restoreFocus, useKey } from "@diffgazer/keys";
import { createContext, type RefObject, useContext, useRef, useState } from "react";

/**
 * Hands the shell header's Back button to screens so their topmost keyboard
 * boundary can route focus into the chrome. The default empty ref makes the
 * hand-off a no-op wherever the shell (or its Back button) is absent.
 */
const HeaderChromeContext = createContext<RefObject<HTMLButtonElement | null>>({ current: null });

export const HeaderChromeProvider = HeaderChromeContext.Provider;

export function useHeaderBackButtonRef(): RefObject<HTMLButtonElement | null> {
  return useContext(HeaderChromeContext);
}

/** The zone a screen parks in while the chrome holds focus. */
export const CHROME_ZONE = "chrome";

/** A screen's two-way link between its topmost keyboard boundary and the chrome. */
interface ChromeBackHandoff<Zone extends string> {
  /** Moves focus to the header Back button and parks the screen's focus zone. */
  handOff: () => void;
  /** The zone ArrowDown returns to, for the parked footer's hint; null until something hands off, and again once the park ends. */
  returnZone: Zone | null;
}

/**
 * The way between a screen's topmost keyboard boundary and the chrome, in both
 * directions. `handOff` focuses the header Back button and parks the page's
 * focus zone, so a single focus mark paints and the zone-derived footer stops
 * advertising the zone that was left; it remembers the control it left, and
 * ArrowDown on the Back button returns focus to exactly that control — the
 * arrow that took focus up brings it back. Reached by Tab instead — nothing
 * remembered, or the park already ended — that arrow declines and stays a
 * native no-op; Tab and Escape keep their native and per-screen meanings either
 * way.
 */
export function useChromeBackHandoff<Zone extends string>({
  zone,
  setZone,
  scope,
}: {
  /** The screen's current focus zone, remembered at hand-off as the way back. */
  zone: Zone;
  // NoInfer keeps the zone union coming from `zone` alone: inferring it from
  // this parameter too would subtract the chrome zone from a screen's own type.
  setZone: (zone: NoInfer<Zone> | typeof CHROME_ZONE) => void;
  /** The screen's keyboard scope, explicit because this hook can run before that scope is pushed. */
  scope: string;
}): ChromeBackHandoff<Zone> {
  const backButtonRef = useHeaderBackButtonRef();
  const [returnZone, setReturnZone] = useState<Zone | null>(null);
  // The element is only ever read by the ArrowDown below and released on that
  // return, so a control that unmounted while parked is not held past it.
  const returnElementRef = useRef<HTMLElement | null>(null);

  // Bound to the Back button itself, so an ArrowDown pressed anywhere else stays
  // with the zone that owns it.
  useKey(
    "ArrowDown",
    () => {
      // Only a live park replays the memory: leaving the chrome by Tab syncs the
      // page's own zone back, so a Back button reached by Tab keeps the arrow
      // native even while an earlier hand-off is still remembered.
      if (returnZone === null || zone !== CHROME_ZONE) return DECLINE;
      const returnElement = returnElementRef.current;
      returnElementRef.current = null;
      setReturnZone(null);
      setZone(returnZone);
      // The remembered control can leave the page while focus is parked (a
      // notice clears, a list reloads); the zone change alone then repairs
      // focus onto that zone's target instead.
      restoreFocus(returnElement);
      return;
    },
    { scope, containerRef: backButtonRef, focusWithinOnly: true, preventDefault: true },
  );

  return {
    // Only a live park has a way back: once focus leaves the chrome by Tab the
    // memory stays for the ArrowDown guard above, but nothing should name it.
    returnZone: zone === CHROME_ZONE ? returnZone : null,
    handOff: () => {
      const backButton = backButtonRef.current;
      if (!backButton) return;
      const element = getRestorableFocusTarget(backButton.ownerDocument);
      returnElementRef.current = element;
      setReturnZone(element ? zone : null);
      backButton.focus();
      setZone(CHROME_ZONE);
    },
  };
}

/**
 * The parked footer's way back, for every screen that hands off: names the zone
 * ArrowDown returns to, the way each zone's own hints name where its arrows go.
 * A screen passes labels for the zones it wants named; with no memory nothing is
 * named, and a zone that carries no label is not named even when the arrow still
 * returns to it.
 */
export function chromeReturnShortcut<Z extends string>(
  zone: Z | null,
  labels: Partial<Record<Z, string>>,
): Shortcut[] {
  const label = zone === null ? undefined : labels[zone];
  return label ? [{ key: "↓", label }] : [];
}
