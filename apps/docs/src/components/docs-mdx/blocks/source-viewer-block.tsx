import { useComponentData, useHookData } from "../doc-data-context"
import { SourceViewer } from "@/components/source-viewer"
import { SectionHeader } from "@/components/ui/section-header/section-header"
import { CopyButton } from "@/components/copy-button"
import { CodeBlock, CodeBlockContent, CodeBlockLine } from "@/components/ui/code-block"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { resolveCrossDepFiles } from "@/lib/cross-deps-data"
import { getInstallCommand, type DocsLibraryId } from "@/lib/docs-library"
import { useCurrentLibrary } from "./use-current-library"

export function SourceViewerBlock() {
  const componentData = useComponentData()
  const hookData = useHookData()
  const library = useCurrentLibrary()

  if (componentData) return <ComponentSourceViewer data={componentData} library={library} />
  if (hookData) return <HookSourceViewer data={hookData} />
  return null
}

function ComponentSourceViewer({ data, library }: { data: NonNullable<ReturnType<typeof useComponentData>>; library: DocsLibraryId }) {
  const installCommand = getInstallCommand(library, data.name) ?? undefined
  const sourceFiles = Object.entries(data.source).map(([path, file]) => ({
    path,
    raw: file.raw,
    highlighted: file.highlighted,
  }))

  if (data.crossDeps?.length) {
    sourceFiles.push(...resolveCrossDepFiles(data.crossDeps) as typeof sourceFiles)
  }

  const externalDeps = data.crossDeps?.filter(d => d.library !== library)
  const integrationNote = externalDeps?.length ? (
    <>
      Keyboard hooks are included as standalone copies.
      For the full experience, use{" "}
      <code className="text-[0.7rem] bg-muted px-1 py-0.5 rounded">
        --integration {externalDeps[0].library}
      </code>.
    </>
  ) : undefined

  return (
    <SourceViewer
      files={sourceFiles}
      mergedSource={data.mergedSource}
      installCommand={installCommand}
      integrationNote={integrationNote}
    />
  )
}

function HookSourceViewer({ data }: { data: NonNullable<ReturnType<typeof useHookData>> }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionHeader as="h3">Source</SectionHeader>
        <CopyButton text={data.source.raw} label={`Copy ${data.title}`} />
      </div>
      <Accordion collapsible className="divide-y-0">
        <AccordionItem value="source" className="py-0">
          <AccordionTrigger variant="source">
            View hook source
          </AccordionTrigger>
          <AccordionContent>
            <CodeBlock>
              <CodeBlockContent>
                {data.source.highlighted.map(line => (
                  <CodeBlockLine key={line.number} {...line} />
                ))}
              </CodeBlockContent>
            </CodeBlock>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
