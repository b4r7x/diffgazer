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
 * element the props sit on. A blur that hands focus to another descendant
 * (`relatedTarget` still contained) is ignored, so moving between children does
 * not flicker the state off and back on.
 */
export function useFocusWithin<T extends HTMLElement>(): FocusWithin<T> {
  const [focusWithin, setFocusWithin] = useState(false);

  return {
    focusWithin,
    props: {
      onFocus: () => setFocusWithin(true),
      onBlur: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      },
    },
  };
}
