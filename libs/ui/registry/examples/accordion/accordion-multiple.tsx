import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

export default function AccordionMultiple() {
  return (
    <Accordion type="multiple" defaultValue={["item-1", "item-3"]}>
      <AccordionItem value="item-1">
        <AccordionTrigger>Section A</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Multiple sections can be open simultaneously.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Section B</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            Click any trigger to toggle that section independently.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Section C</AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            This section starts open because its value is in the defaultValue array.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
