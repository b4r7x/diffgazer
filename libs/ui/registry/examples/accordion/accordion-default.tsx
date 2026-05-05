import { Accordion, AccordionHeader, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

export default function AccordionDefault() {
  return (
    <Accordion defaultValue="item-1">
      <AccordionItem value="item-1">
        <AccordionHeader>
          <AccordionTrigger>What is @diffgazer/ui?</AccordionTrigger>
        </AccordionHeader>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            A terminal-inspired component registry for React. Install components via CLI and own the source.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionHeader>
          <AccordionTrigger>How do I install components?</AccordionTrigger>
        </AccordionHeader>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Run <code className="text-xs bg-border px-1 rounded">dgadd add button</code> to add a component to your project.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionHeader>
          <AccordionTrigger>Can I customize components?</AccordionTrigger>
        </AccordionHeader>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Yes. Components are copied into your project as source files. Modify them freely.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
