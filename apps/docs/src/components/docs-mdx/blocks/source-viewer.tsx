import { InlineCode } from "@diffgazer/ui/components/code-block";
import { CopyButton } from "@/components/copy-button";
import { SourceViewer } from "@/components/docs-mdx/source-viewer";
import { type CrossDepSourceFile, resolveCrossDepFiles } from "@/lib/cross-deps-data";
import { type DocsLibraryId, getInstallCommand } from "@/lib/library";
import type { ComponentData, SourceFile } from "@/types/data";
import { type HookData, useComponentData, useHookData } from "../doc-data-context";
import { useCurrentLibrary } from "./use-current-library";

/** Map cross-dependency files (keys hooks/utilities) into the SourceViewer file shape. */
function toSourceFiles(
  crossDeps: NonNullable<ComponentData["crossDeps"]>,
): (SourceFile & { path: string })[] {
  return resolveCrossDepFiles(crossDeps).map((file: CrossDepSourceFile) => ({
    path: file.path,
    raw: file.raw,
    highlighted: file.highlighted,
  }));
}

export function SourceViewerBlock() {
  const componentData = useComponentData();
  const hookData = useHookData();
  const library = useCurrentLibrary();

  if (componentData) return <ComponentSourceViewer data={componentData} library={library} />;
  if (hookData) return <HookSourceViewer data={hookData} />;
  return null;
}

function ComponentSourceViewer({ data, library }: { data: ComponentData; library: DocsLibraryId }) {
  const installCommand = getInstallCommand(library, data.name) ?? undefined;
  const sourceFiles = Object.entries(data.source).map(([path, file]) => ({
    path,
    raw: file.raw,
    highlighted: file.highlighted,
  }));

  if (data.crossDeps?.length) {
    sourceFiles.push(...toSourceFiles(data.crossDeps));
  }

  const externalDeps = data.crossDeps?.filter((d) => d.library !== library);
  const firstExternalDep = externalDeps?.[0];
  const integrationNote = firstExternalDep ? (
    <>
      Keyboard hooks are included as standalone copies. For the full experience, use{" "}
      <InlineCode>--integration {firstExternalDep.library}</InlineCode>.
    </>
  ) : undefined;

  return (
    <SourceViewer
      files={sourceFiles}
      copyButton={
        data.mergedSource ? (
          <CopyButton
            text={data.mergedSource}
            label="Copy Full Source"
            title="Copies all component files, hooks, and utilities merged into a single standalone file"
          />
        ) : undefined
      }
      installCommand={installCommand}
      integrationNote={integrationNote}
    />
  );
}

function HookSourceViewer({ data }: { data: HookData }) {
  const fileName = data.name.startsWith("use-") ? `${data.name}.ts` : `use-${data.name}.ts`;
  return (
    <SourceViewer
      files={[{ path: fileName, raw: data.source.raw, highlighted: data.source.highlighted }]}
      triggerLabel="View hook source"
      copyButton={<CopyButton text={data.source.raw} label={`Copy ${data.title}`} />}
    />
  );
}
