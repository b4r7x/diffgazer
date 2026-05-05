import { SectionHeader } from "@/components/ui/section-header/section-header"
import { CodeBlock, CodeBlockContent, CodeBlockLine } from "@/components/ui/code-block"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import type { SourceFile } from "@/types/docs-data"
import { CopyButton } from "./copy-button"
import type React from "react"

interface SourceViewerProps {
  files: (SourceFile & { path: string })[]
  mergedSource?: string
  name?: string
  installCommand?: string
  integrationNote?: React.ReactNode
}

export function SourceViewer({ files, mergedSource, name, installCommand, integrationNote }: SourceViewerProps) {
  if (files.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <SectionHeader as="h3">Source</SectionHeader>
        {mergedSource && (
          <CopyButton
            text={mergedSource}
            label="Copy Full Source"
            title="Copies all component files, hooks, and utilities merged into a single standalone file"
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3 mt-1">
        Install via CLI: <code className="text-[0.7rem] bg-muted px-1 py-0.5 rounded">{installCommand ?? `npx @diffgazer/add${name ? ` ${name}` : ""}`}</code>.
        {integrationNote && <>{" "}{integrationNote}</>}
      </p>

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
                <CodeBlock>
                  <CodeBlockContent>
                    {file.highlighted.map(line => (
                      <CodeBlockLine key={line.number} {...line} />
                    ))}
                  </CodeBlockContent>
                </CodeBlock>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
