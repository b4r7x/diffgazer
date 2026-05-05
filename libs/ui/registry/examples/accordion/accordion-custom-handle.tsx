import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

export default function AccordionCustomHandle() {
  return (
    <Accordion type="multiple" defaultValue={["item-1"]}>
      <AccordionItem value="item-1">
        <AccordionTrigger handle={<span className="text-xs font-mono shrink-0">+</span>}>
          Custom handle (+)
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Pass any ReactNode as the handle prop to replace the default chevron.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger handle={null}>
          No handle (hidden)
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Pass handle={"{null}"} to hide the indicator entirely.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>
          Default chevron
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Without the handle prop, the animated Chevron component is used by default.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
