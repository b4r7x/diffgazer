"use client";

import { isInsideDisabledFieldset } from "@diffgazer/keys";
import { type RefObject, useLayoutEffect, useState } from "react";

function getAncestorFieldsets(element: HTMLElement): HTMLElement[] {
  const fieldsets: HTMLElement[] = [];
  let ancestor = element.parentElement;
  while (ancestor) {
    if (ancestor.tagName === "FIELDSET") fieldsets.push(ancestor);
    ancestor = ancestor.parentElement;
  }
  return fieldsets;
}

/** Tracks native disabled-fieldset inheritance, including the first-legend exception. */
export function useFieldsetDisabled(ref: RefObject<HTMLElement | null>): boolean {
  const [isDisabled, setIsDisabled] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    const View = element?.ownerDocument.defaultView;
    if (!element || !View?.MutationObserver) return;

    const update = () => setIsDisabled(isInsideDisabledFieldset(element));
    const observer = new View.MutationObserver(update);
    for (const fieldset of getAncestorFieldsets(element)) {
      observer.observe(fieldset, {
        attributes: true,
        attributeFilter: ["disabled"],
        childList: true,
        subtree: true,
      });
    }
    update();
    return () => observer.disconnect();
  }, [ref]);

  return isDisabled;
}
