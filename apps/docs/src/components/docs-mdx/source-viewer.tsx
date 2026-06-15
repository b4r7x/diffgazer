import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@diffgazer/ui/components/accordion";
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockLine,
  InlineCode,
} from "@diffgazer/ui/components/code-block";
import { Typography } from "@diffgazer/ui/components/typography";
import type React from "react";
import { LOCAL_DGADD_PREREQUISITE } from "@/lib/library";
import type { SourceFile } from "@/types/data";
import { CopyButton } from "../copy-button";
import { SourceHeading } from "./source-heading";

interface SourceViewerProps {
  files: (SourceFile & { path: string })[];
  installCommand?: string;
  integrationNote?: React.ReactNode;
  /** Override the accordion trigger label (defaults to "View component source"). */
  triggerLabel?: React.ReactNode;
  /** Render the "Source" heading section. Standalone blocks pass false. */
  showHeading?: boolean;
  /** Copy control rendered in the heading (or beside the trigger when no heading). */
  copyButton?: React.ReactNode;
  /** Description line rendered under the trigger (standalone hook blocks). */
  description?: React.ReactNode;
}

export function SourceViewer({
  files,
  installCommand,
  integrationNote,
  triggerLabel,
  showHeading = true,
  copyButton,
  description,
}: SourceViewerProps) {
  if (files.length === 0) return null;

  const defaultLabel = (
    <>
      View component source
      {files.length > 1 ? ` (${files.length} files)` : ""}
    </>
  );

  // Single-file blocks name the file via triggerLabel + a header copy button, so
  // the per-file path/copy row inside the content would just be a duplicate.
  const showFileHeaders = !(files.length === 1 && triggerLabel && copyButton);

  return (
    <div className="mb-8">
      {showHeading && <SourceHeading>{copyButton}</SourceHeading>}
      {(installCommand || integrationNote) && (
        <Typography as="p" size="sm" className="mb-3 mt-1">
          {installCommand && (
            <>
              Install via CLI: <InlineCode>{installCommand}</InlineCode>. {LOCAL_DGADD_PREREQUISITE}
            </>
          )}
          {installCommand && integrationNote && " "}
          {integrationNote}
        </Typography>
      )}

      <Accordion collapsible className="divide-y-0">
        <AccordionItem value="source" className="py-0">
          {!showHeading && (copyButton || description) ? (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <AccordionTrigger variant="source">{triggerLabel ?? defaultLabel}</AccordionTrigger>
                {description && (
                  <p className="text-xs text-muted-foreground -mt-1 mb-2">{description}</p>
                )}
              </div>
              {copyButton}
            </div>
          ) : (
            <AccordionTrigger variant="source">{triggerLabel ?? defaultLabel}</AccordionTrigger>
          )}
          <AccordionContent className="space-y-4">
            {files.map((file) => (
              <div key={file.path}>
                {showFileHeaders && (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{file.path}</span>
                    <CopyButton text={file.raw} />
                  </div>
                )}
                <CodeBlock>
                  <CodeBlockContent>
                    {file.highlighted.map((line) => (
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
  );
}
