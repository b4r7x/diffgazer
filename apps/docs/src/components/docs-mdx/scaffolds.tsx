import { AccessibilityNotes } from "./blocks/accessibility-notes";
import { APIReference } from "./blocks/api-reference";
import { ConsumptionBlock } from "./blocks/consumption";
import { Example } from "./blocks/example";
import { Examples } from "./blocks/examples";
import { hasKeyboardNavContent, KeyboardNav } from "./blocks/keyboard-nav";
import { Notes } from "./blocks/notes";
import { ParameterTableBlock } from "./blocks/parameter-table-block";
import { ReturnsTable } from "./blocks/returns-table";
import { SourceViewerBlock } from "./blocks/source-viewer-block";
import { UsageSnippet } from "./blocks/usage-snippet";
import { useCurrentLibrary } from "./blocks/use-current-library";
import { useComponentData, useHookData } from "./doc-data-context";
import { SectionHeading } from "./section-heading";

export function ComponentDocScaffold({ hero }: { hero: string }) {
  const data = useComponentData();
  const library = useCurrentLibrary();
  if (!data || (library !== "ui" && library !== "keys")) return null;

  const hasAccessibility =
    hasKeyboardNavContent(data.docs?.keyboard) || (data.docs?.notes?.length ?? 0) > 0;

  return (
    <>
      <Example name={hero} />

      <SectionHeading id="installation">Installation</SectionHeading>
      <ConsumptionBlock />

      {data.usageSnippetHighlighted.length > 0 && (
        <>
          <SectionHeading id="usage">Usage</SectionHeading>
          <UsageSnippet />
        </>
      )}

      <Examples hero={hero} showHeading />

      <APIReference />

      {hasAccessibility && (
        <>
          <SectionHeading id="accessibility">Accessibility</SectionHeading>
          <KeyboardNav />
          <AccessibilityNotes />
        </>
      )}

      {data.files.length > 0 && <SourceViewerBlock />}
    </>
  );
}

export function HookDocScaffold() {
  const data = useHookData();
  const library = useCurrentLibrary();
  if (!data || (library !== "ui" && library !== "keys")) return null;

  return (
    <>
      <UsageSnippet />

      <SectionHeading id="installation">Installation</SectionHeading>
      <ConsumptionBlock />

      {(data.docs?.parameters?.length ?? 0) > 0 && (
        <>
          <SectionHeading id="parameters">Parameters</SectionHeading>
          <ParameterTableBlock />
        </>
      )}

      {data.docs?.returns && (
        <>
          <SectionHeading id="returns">Returns</SectionHeading>
          <ReturnsTable />
        </>
      )}

      <Examples showHeading />

      {(data.docs?.notes?.length ?? 0) > 0 && (
        <>
          <SectionHeading id="notes">Notes</SectionHeading>
          <Notes />
        </>
      )}

      {(data.files?.length ?? 0) > 0 && <SourceViewerBlock />}
    </>
  );
}
