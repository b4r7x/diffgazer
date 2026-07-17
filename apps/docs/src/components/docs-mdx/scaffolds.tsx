import { prepareComponentScaffoldData, prepareHookScaffoldData } from "@/lib/scaffold-data";
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
import { useCurrentLibrary } from "./blocks/use-current-library";
import { useComponentData, useHookData } from "./doc-data-context";
import { SectionHeading } from "./section-heading";

export function ComponentDocScaffold({ hero }: { hero: string }) {
  const data = useComponentData();
  const library = useCurrentLibrary();
  if (!data || (library !== "ui" && library !== "keys")) return null;

  const scaffold = prepareComponentScaffoldData(library, data);
  const hasApiReference =
    Object.keys(scaffold.props).length > 0 ||
    scaffold.dataAttributes.length > 0 ||
    scaffold.cssVariables.length > 0;
  const hasAccessibility = scaffold.keyboard !== null || scaffold.accessibilityNotes.length > 0;

  return (
    <>
      <Example name={hero} />

      <SectionHeading id="installation">Installation</SectionHeading>
      <ConsumptionBlock />

      {scaffold.usage && (
        <>
          <SectionHeading id="usage">Usage</SectionHeading>
          <UsageSnippet />
        </>
      )}

      {scaffold.examples.length > 1 && <Examples skipFirst showHeading />}

      {hasApiReference && <APIReference />}

      {hasAccessibility && (
        <>
          <SectionHeading id="accessibility">Accessibility</SectionHeading>
          <KeyboardNav />
          <AccessibilityNotes />
        </>
      )}

      {scaffold.sourceFiles.length > 0 && <SourceViewerBlock />}
    </>
  );
}

export function HookDocScaffold() {
  const data = useHookData();
  const library = useCurrentLibrary();
  if (!data || (library !== "ui" && library !== "keys")) return null;

  const scaffold = prepareHookScaffoldData(library, data);

  return (
    <>
      {scaffold.usage && <UsageSnippet />}

      <SectionHeading id="installation">Installation</SectionHeading>
      <ConsumptionBlock />

      {scaffold.parameters.length > 0 && (
        <>
          <SectionHeading id="parameters">Parameters</SectionHeading>
          <ParameterTableBlock />
        </>
      )}

      {scaffold.returns && (
        <>
          <SectionHeading id="returns">Returns</SectionHeading>
          <ReturnsTable />
        </>
      )}

      {scaffold.examples.length > 0 && <Examples showHeading />}

      {scaffold.notes.length > 0 && (
        <>
          <SectionHeading id="notes">Notes</SectionHeading>
          <Notes />
        </>
      )}

      {scaffold.sourceFiles.length > 0 && <SourceViewerBlock />}
    </>
  );
}
