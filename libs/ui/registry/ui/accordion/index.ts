"use client";

import {
  type AccordionMultipleProps,
  type AccordionProps,
  Accordion as AccordionRoot,
  type AccordionSingleProps,
} from "./accordion";
import { AccordionContent, type AccordionContentProps } from "./accordion-content";
import { AccordionHeader, type AccordionHeaderProps } from "./accordion-header";
import { AccordionItem, type AccordionItemProps } from "./accordion-item";
import {
  AccordionTrigger,
  type AccordionTriggerProps,
  type AccordionTriggerVariantProps,
  accordionTriggerVariants,
} from "./accordion-trigger";

/**
 * Collapsible content sections with single or multiple open items. Supports controlled and
 * uncontrolled modes.
 */
const Accordion = Object.assign(AccordionRoot, {
  Header: AccordionHeader,
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
});

export { Accordion, type AccordionProps, type AccordionSingleProps, type AccordionMultipleProps };
export { AccordionHeader, type AccordionHeaderProps };
export { AccordionItem, type AccordionItemProps };
export {
  AccordionTrigger,
  accordionTriggerVariants,
  type AccordionTriggerProps,
  type AccordionTriggerVariantProps,
};
export { AccordionContent, type AccordionContentProps };
