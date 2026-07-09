"use client";

import { getNavigationItems } from "@diffgazer/keys";
import { type KeyboardEvent as ReactKeyboardEvent, useMemo, useRef } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { cn } from "@/lib/utils";
import { AccordionContext } from "./accordion-context";
import { type AccordionProps, useAccordionState } from "./use-state";

export type {
  AccordionMultipleProps,
  AccordionProps,
  AccordionSingleProps,
} from "./use-state";

const ACCORDION_ROOT_ATTRIBUTE = "data-diffgazer-accordion-root";

function getNavigableTriggers(container: HTMLElement | null): HTMLElement[] {
  // aria-disabled non-collapsible triggers stay in the roving order (APG); only real disabled are filtered here.
  return getNavigationItems(container, {
    type: "button",
    skipDisabled: false,
    ownerSelector: `[${ACCORDION_ROOT_ATTRIBUTE}]`,
  }).filter((trigger) => {
    const View = trigger.ownerDocument.defaultView;
    if (trigger.dataset.disabled !== undefined) return false;
    if (View && trigger instanceof View.HTMLButtonElement && trigger.disabled) return false;
    return true;
  });
}

function getDeepActiveElement(root: Document): Element | null {
  let active = root.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

function containsActiveElement(el: HTMLElement): boolean {
  const activeElement = getDeepActiveElement(el.ownerDocument);
  const View = el.ownerDocument.defaultView;
  return Boolean(View && activeElement instanceof View.HTMLElement && el.contains(activeElement));
}

/**
 * Collapsible content sections with single or multiple open items. Supports controlled and
 * uncontrolled modes.
 */
function AccordionRoot(props: AccordionProps) {
  const {
    ref,
    onKeyDown: externalOnKeyDown,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
  } = props;
  const { openValues, onToggle, collapsible } = useAccordionState(props);
  const containerRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(containerRef, ref);

  const focusTrigger = (index: number) => {
    const triggers = getNavigableTriggers(containerRef.current);
    const trigger = triggers[index];
    if (!trigger) return;

    trigger.scrollIntoView?.({ block: "nearest" });
    trigger.focus();
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    externalOnKeyDown?.(e);
    if (e.defaultPrevented) return;

    const triggers = getNavigableTriggers(containerRef.current);
    if (triggers.length === 0) return;

    const currentIndex = triggers.findIndex(containsActiveElement);
    if (currentIndex < 0) return;

    switch (e.key) {
      case "ArrowUp":
        focusTrigger(currentIndex <= 0 ? triggers.length - 1 : currentIndex - 1);
        e.preventDefault();
        break;
      case "ArrowDown":
        focusTrigger(currentIndex >= triggers.length - 1 ? 0 : currentIndex + 1);
        e.preventDefault();
        break;
      case "Home":
        focusTrigger(0);
        e.preventDefault();
        break;
      case "End":
        focusTrigger(triggers.length - 1);
        e.preventDefault();
        break;
    }
  };

  const contextValue = useMemo(
    () => ({ value: openValues, onToggle, collapsible }),
    [openValues, onToggle, collapsible],
  );

  return (
    <AccordionContext value={contextValue}>
      {/* biome-ignore lint/a11y/useSemanticElements: role="group" labels the related set of accordion panels; <fieldset> is for form controls and is not appropriate here. */}
      <div
        ref={composedRef}
        role="group"
        data-slot="accordion"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn("divide-y divide-border", props.className)}
        onKeyDown={handleKeyDown}
        {...{ [ACCORDION_ROOT_ATTRIBUTE]: "" }}
      >
        {props.children}
      </div>
    </AccordionContext>
  );
}

export { AccordionRoot as Accordion };
