"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useMemo,
  useRef,
} from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { AccordionContext } from "./accordion-context";
import { useAccordionState } from "./use-accordion-state";

export interface AccordionSingleProps {
  type?: "single";
  value?: string;
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
  onChange?: (value: string[]) => void;
  defaultValue?: string[];
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
}

export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

function AccordionRoot(props: AccordionProps) {
  const { ref, onKeyDown: externalOnKeyDown } = props;
  const { openValues, onToggle, collapsible } = useAccordionState(props);
  const containerRef = useRef<HTMLDivElement>(null);

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "button",
    orientation: "vertical",
    wrap: true,
    moveFocus: true,
  });

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    externalOnKeyDown?.(e);
    if (!e.defaultPrevented) navKeyDown(e);
  };

  const contextValue = useMemo(
    () => ({ value: openValues, onToggle, collapsible }),
    [openValues, collapsible],
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
