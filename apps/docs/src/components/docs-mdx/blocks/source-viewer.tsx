import { InlineCode } from "@diffgazer/ui/components/code-block";
import { SourceViewer, type SourceViewerContent } from "@/components/docs-mdx/source-viewer";
import {
  type DocsLibraryId,
  getDocsLibraryConfig,
  getInstallCommand,
  hookFileName,
} from "@/lib/library";
import { loadDocSourceData } from "@/lib/load-doc-data";
import {
  type ComponentPageData,
  type HookPageData,
  useComponentData,
  useHookData,
} from "../doc-data-context";
import { useCurrentLibrary } from "./use-current-library";

async function loadComponentSource(
  library: DocsLibraryId,
  name: string,
): Promise<SourceViewerContent> {
  const component = await loadDocSourceData(library, "components", name, {
    throwIfMissing: true,
  });
  if (!component) throw new Error(`Missing component source: ${library}/${name}`);

  return {
    files: Object.entries(component.source).map(([path, file]) => ({
      path,
      raw: file.raw,
      highlighted: file.highlighted,
    })),
    copyText: component.mergedSource,
  };
}

async function loadHookSource(library: DocsLibraryId, name: string): Promise<SourceViewerContent> {
  const hook = await loadDocSourceData(library, "hooks", name, { throwIfMissing: true });
  if (!hook) throw new Error(`Missing hook source: ${library}/${name}`);

  const files =
    hook.files && hook.files.length > 0
      ? hook.files
      : [
          {
            path: hookFileName(name),
            raw: hook.source.raw,
            highlighted: hook.source.highlighted,
          },
        ];

  return {
    files,
    copyText:
      files.length === 1
        ? (files[0]?.raw ?? "")
        : files.map((file) => `// ${file.path}\n${file.raw}`).join("\n\n"),
  };
}

export function SourceViewerBlock() {
  const componentData = useComponentData();
  const hookData = useHookData();
  const library = useCurrentLibrary();

  if (componentData) return <ComponentSourceViewer data={componentData} library={library} />;
  if (hookData) return <HookSourceViewer data={hookData} library={library} />;
  return null;
}

function ComponentSourceViewer({
  data,
  library,
}: {
  data: ComponentPageData;
  library: DocsLibraryId;
}) {
  const installCommand = getInstallCommand(library, data.name) ?? undefined;
  const externalDeps = data.crossDeps?.filter((d) => d.library !== library);
  const firstExternalDep = externalDeps?.[0];
  const integrationNote = firstExternalDep ? (
    <>
      Keyboard hooks are included as standalone copies. For the full experience, use{" "}
      <InlineCode>--integration {firstExternalDep.library}</InlineCode>.
    </>
  ) : undefined;
  const cacheKey = `${library}:component:${data.name}`;
  const fileCount = data.files.length;

  return (
    <SourceViewer
      key={cacheKey}
      cacheKey={cacheKey}
      fileCount={fileCount}
      loadSource={() => loadComponentSource(library, data.name)}
      copyLabel="Copy Full Source"
      copyTitle="Copies a dependency-closed registry archive with every file and local import rewrite"
      installCommand={installCommand}
      integrationNote={integrationNote}
      sourceHref={getDocsLibraryConfig(library).githubUrl}
    />
  );
}

function HookSourceViewer({ data, library }: { data: HookPageData; library: DocsLibraryId }) {
  const cacheKey = `${library}:hook:${data.name}`;
  const fileCount = data.files?.length ?? 1;
  return (
    <SourceViewer
      key={cacheKey}
      cacheKey={cacheKey}
      fileCount={fileCount}
      loadSource={() => loadHookSource(library, data.name)}
      triggerLabel={fileCount === 1 ? "View hook source" : `View hook source (${fileCount} files)`}
      copyLabel={`Copy ${data.title}`}
      copyTitle="Copies every source file with its consumer target path"
      sourceHref={getDocsLibraryConfig(library).githubUrl}
    />
  );
}
