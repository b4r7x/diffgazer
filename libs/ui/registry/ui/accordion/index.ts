"use client";

import { Accordion as AccordionRoot, type AccordionProps, type AccordionSingleProps, type AccordionMultipleProps } from "./accordion";
import { AccordionHeader, type AccordionHeaderProps } from "./accordion-header";
import { AccordionItem, type AccordionItemProps } from "./accordion-item";
import { AccordionTrigger, triggerVariants, type AccordionTriggerProps, type AccordionTriggerVariantProps } from "./accordion-trigger";
import { AccordionContent, type AccordionContentProps } from "./accordion-content";

const Accordion = Object.assign(AccordionRoot, {
  Header: AccordionHeader,
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
});

export { Accordion, type AccordionProps, type AccordionSingleProps, type AccordionMultipleProps };
export { AccordionHeader, type AccordionHeaderProps };
export { AccordionItem, type AccordionItemProps };
export { AccordionTrigger, triggerVariants, type AccordionTriggerProps, type AccordionTriggerVariantProps };
export { AccordionContent, type AccordionContentProps };
