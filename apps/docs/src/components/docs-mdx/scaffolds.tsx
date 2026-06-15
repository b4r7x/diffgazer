import { Typography } from "@diffgazer/ui/components/typography";
import { AccessibilityNotes } from "./blocks/accessibility-notes";
import { APIReference } from "./blocks/api-reference";
import { ConsumptionBlock } from "./blocks/consumption";
import { Example } from "./blocks/example";
import { Examples } from "./blocks/examples";
import { KeyboardNav } from "./blocks/keyboard-nav";
import { Notes } from "./blocks/notes";
import { ParameterTableBlock } from "./blocks/parameter-table";
import { ReturnsTable } from "./blocks/returns-table";
import { SourceViewerBlock } from "./blocks/source-viewer";
import { UsageSnippet } from "./blocks/usage-snippet";

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <Typography
      as="h2"
      size="xl"
      id={id}
      className="font-bold text-foreground mt-10 mb-4 pb-2 border-b border-border scroll-mt-16"
    >
      {children}
    </Typography>
  );
}

export function ComponentDocScaffold({ hero }: { hero: string }) {
  return (
    <>
      <Example name={hero} />

      <SectionHeading id="installation">Installation</SectionHeading>
      <ConsumptionBlock />

      <SectionHeading id="usage">Usage</SectionHeading>
      <UsageSnippet />

      <Examples skipFirst showHeading />

      <APIReference />

      <SectionHeading id="accessibility">Accessibility</SectionHeading>
      <KeyboardNav />
      <AccessibilityNotes />

      <SourceViewerBlock />
    </>
  );
}

export function HookDocScaffold() {
  return (
    <>
      <UsageSnippet />

      <SectionHeading id="installation">Installation</SectionHeading>
      <ConsumptionBlock />

      <SectionHeading id="parameters">Parameters</SectionHeading>
      <ParameterTableBlock />

      <SectionHeading id="returns">Returns</SectionHeading>
      <ReturnsTable />

      <Examples showHeading />

      <SectionHeading id="notes">Notes</SectionHeading>
      <Notes />

      <SourceViewerBlock />
    </>
  );
}
