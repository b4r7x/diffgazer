import { containsActiveElement } from "@diffgazer/keys";
import { type FocusEventHandler, useState } from "react";

type FocusWithin<T extends HTMLElement> = {
  focusWithin: boolean;
  props: { onFocus: FocusEventHandler<T>; onBlur: FocusEventHandler<T> };
};

/**
 * Tracks whether focus currently sits inside the element the returned `props`
 * are spread on, so a Panel can claim focused chrome only while it actually
 * holds focus instead of pinning `focused` statically.
 *
 * State is derived from the focus events themselves — React's `onFocus`/`onBlur`
 * are the bubbling focusin/focusout pair, so descendant focus reaches the
 * element the props sit on. A blur that leaves focus inside is ignored, so
 * neither a move between children (`relatedTarget` still contained) nor
 * deactivating the window (no `relatedTarget`, DOM focus unmoved) flickers the
 * state off and back on.
 */
export function useFocusWithin<T extends HTMLElement>(): FocusWithin<T> {
  const [focusWithin, setFocusWithin] = useState(false);

  return {
    focusWithin,
    props: {
      onFocus: () => setFocusWithin(true),
      onBlur: (event) => {
        // Deactivating the window fires focusout with no relatedTarget while the
        // focused element keeps focus, so the mark would blink off and back on
        // for a switch that never moved the keyboard. The TUI's reticle does not
        // blink when the terminal loses focus; neither does this one.
        if (event.relatedTarget === null && containsActiveElement(event.currentTarget)) return;
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      },
    },
  };
}
