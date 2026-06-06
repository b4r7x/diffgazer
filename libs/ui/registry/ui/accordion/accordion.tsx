"use client";

import { getNavigationItems } from "@diffgazer/keys";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useMemo,
  useRef,
} from "react";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { AccordionContext } from "./accordion-context";
import { useAccordionState } from "./use-state";

const ACCORDION_ROOT_ATTRIBUTE = "data-diffgazer-accordion-root";

export interface AccordionSingleProps {
  type?: "single";
  value?: string;
  onChange?: (value: string | null) => void;
  defaultValue?: string;
  collapsible?: boolean;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  ref?: Ref<HTMLDivElement>;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
}

export interface AccordionMultipleProps {
  type: "multiple";
  value?: string[];
  onChange?: (value: string[]) => void;
  defaultValue?: string[];
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  ref?: Ref<HTMLDivElement>;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
}

export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

function getNavigableTriggers(container: HTMLElement | null): HTMLElement[] {
  // Use skipDisabled: false because aria-disabled non-collapsible triggers
  // remain in the roving tab order per APG. Filter explicit HTML/data-disabled
  // ourselves.
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

function containsActiveElement(el: HTMLElement): boolean {
  const activeElement = el.ownerDocument.activeElement;
  const View = el.ownerDocument.defaultView;
  return Boolean(View && activeElement instanceof View.HTMLElement && el.contains(activeElement));
}

function AccordionRoot(props: AccordionProps) {
  const { ref, onKeyDown: externalOnKeyDown, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy } = props;
  const { openValues, onToggle, collapsible } = useAccordionState(props);
  const containerRef = useRef<HTMLDivElement>(null);

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
        ref={composeRefs(containerRef, ref)}
        role="group"
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
