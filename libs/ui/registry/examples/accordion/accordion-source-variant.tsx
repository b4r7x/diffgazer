import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CodeBlock, CodeBlockContent, CodeBlockLine } from "@/components/ui/code-block";

// variant="source" is the small inline toggle used above code and diff panes.
const SOURCE_LINES = [
  { number: 1, content: 'import { Accordion } from "@diffgazer/ui/components/accordion";' },
  { number: 2, content: "" },
  { number: 3, content: 'export const Faq = () => <Accordion type="multiple" />;' },
];

export default function AccordionSourceVariant() {
  return (
    <Accordion type="multiple" defaultValue={["source"]} className="w-full">
      <AccordionItem value="source">
        <AccordionTrigger variant="source">Show source</AccordionTrigger>
        <AccordionContent>
          <CodeBlock>
            <CodeBlockContent>
              {SOURCE_LINES.map((line) => (
                <CodeBlockLine key={line.number} {...line} />
              ))}
            </CodeBlockContent>
          </CodeBlock>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="notes">
        <AccordionTrigger variant="source">Show notes</AccordionTrigger>
        <AccordionContent>
          <p className="text-xs text-muted-foreground">
            The source variant drops to text-xs and adds bottom spacing so it reads as a caption
            above the block it toggles, not as a section header.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
