import { SectionHeader } from "@/components/ui/section-header/section-header"
import { CodeBlock } from "@/components/ui/code-block/code-block"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import type { SourceFile } from "@/types/docs-data"
import { CopyButton } from "./copy-button"

interface SourceViewerProps {
  files: (SourceFile & { path: string })[]
  mergedSource?: string
}

export function SourceViewer({ files, mergedSource }: SourceViewerProps) {
  if (files.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <SectionHeader as="h3">Source</SectionHeader>
        {mergedSource && (
          <CopyButton text={mergedSource} label="Copy Component" />
        )}
      </div>

      <Accordion collapsible className="divide-y-0">
        <AccordionItem value="source" className="py-0">
          <AccordionTrigger variant="source">
            View component source
            {files.length > 1 ? ` (${files.length} files)` : ""}
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            {files.map((file) => (
              <div key={file.path}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-muted-foreground">
                    {file.path}
                  </span>
                  <CopyButton text={file.raw} />
                </div>
                <CodeBlock lines={file.highlighted} />
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
