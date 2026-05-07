"use client";

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
import { useAccordionState } from "./use-accordion-state";

export interface AccordionSingleProps {
  type?: "single";
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  /** @deprecated Use `onValueChange` for controlled value updates. */
  onChange?: (value: string | undefined) => void;
  defaultValue?: string;
  collapsible?: boolean;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
}

export interface AccordionMultipleProps {
  type: "multiple";
  value?: string[];
  onValueChange?: (value: string[]) => void;
  /** @deprecated Use `onValueChange` for controlled value updates. */
  onChange?: (value: string[]) => void;
  defaultValue?: string[];
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
}

export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

function getNavigableTriggers(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-diffgazer-navigation-item="button"][data-value]'),
  ).filter((trigger) => {
    if (trigger.dataset.disabled !== undefined) return false;
    if (trigger instanceof HTMLButtonElement && trigger.disabled) return false;
    return true;
  });
}

function containsActiveElement(el: HTMLElement): boolean {
  const activeElement = el.ownerDocument.activeElement;
  return activeElement instanceof HTMLElement && el.contains(activeElement);
}

function AccordionRoot(props: AccordionProps) {
  const { ref, onKeyDown: externalOnKeyDown } = props;
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
      <div
        ref={composeRefs(containerRef, ref)}
        role="group"
        className={cn("divide-y divide-border", props.className)}
        onKeyDown={handleKeyDown}
      >
        {props.children}
      </div>
    </AccordionContext>
  );
}

export { AccordionRoot as Accordion };
