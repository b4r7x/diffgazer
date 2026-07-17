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
import { type ReactNode, useState } from "react";
import type { SourceFile } from "@/types/data";
import { CopyButton } from "../copy-button";
import { SourceHeading } from "./source-heading";

export interface SourceViewerContent {
  files: Array<{
    path: string;
    raw: string;
    highlighted: Array<{
      number?: number;
      content?: string | Array<{ text: string; color?: string; className?: string }>;
      state?: "highlight" | "added" | "removed";
    }>;
  }>;
  copyText?: string;
}

interface CommonSourceViewerProps {
  installCommand?: string;
  integrationNote?: ReactNode;
  triggerLabel?: ReactNode;
  showHeading?: boolean;
  copyButton?: ReactNode;
  copyLabel?: string;
  copyTitle?: string;
  description?: ReactNode;
  sourceHref?: string;
}

interface EagerSourceViewerProps {
  files: (SourceFile & { path: string })[];
  cacheKey?: never;
  fileCount?: never;
  loadSource?: never;
}

interface LazySourceViewerProps {
  files?: never;
  cacheKey: string;
  fileCount?: number;
  loadSource: () => Promise<SourceViewerContent>;
}

type SourceViewerProps = CommonSourceViewerProps & (EagerSourceViewerProps | LazySourceViewerProps);

type SourceLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; content: SourceViewerContent }
  | { status: "error" };

const sourceCache = new Map<string, Promise<SourceViewerContent>>();
const SOURCE_CACHE_MAX_ENTRIES = 8;

function cacheSourceRequest(cacheKey: string, request: Promise<SourceViewerContent>): void {
  sourceCache.set(cacheKey, request);
  if (sourceCache.size <= SOURCE_CACHE_MAX_ENTRIES) return;

  const oldestKey = sourceCache.keys().next().value;
  if (oldestKey !== undefined) sourceCache.delete(oldestKey);
}

function loadCachedSource(
  cacheKey: string,
  loadSource: () => Promise<SourceViewerContent>,
): Promise<SourceViewerContent> {
  const cached = sourceCache.get(cacheKey);
  if (cached) {
    sourceCache.delete(cacheKey);
    sourceCache.set(cacheKey, cached);
    return cached;
  }

  let request: Promise<SourceViewerContent>;
  request = loadSource().catch((error: unknown) => {
    if (sourceCache.get(cacheKey) === request) sourceCache.delete(cacheKey);
    throw error;
  });
  cacheSourceRequest(cacheKey, request);
  return request;
}

function isLazySourceViewer(
  props: SourceViewerProps,
): props is CommonSourceViewerProps & LazySourceViewerProps {
  return props.loadSource !== undefined;
}

export function SourceViewer(props: SourceViewerProps) {
  const {
    installCommand,
    integrationNote,
    triggerLabel,
    showHeading = true,
    copyButton,
    copyLabel,
    copyTitle,
    description,
    sourceHref,
  } = props;
  const [openValue, setOpenValue] = useState("");
  const [sourceState, setSourceState] = useState<SourceLoadState>({ status: "idle" });
  const isLazy = isLazySourceViewer(props);
  const loadedContent = sourceState.status === "ready" ? sourceState.content : null;
  const files = isLazy ? (loadedContent?.files ?? []) : props.files;

  if (!isLazy && files.length === 0) return null;

  const requestSource = async (): Promise<void> => {
    if (!isLazy || sourceState.status === "loading" || sourceState.status === "ready") return;

    setSourceState({ status: "loading" });
    try {
      const content = await loadCachedSource(props.cacheKey, props.loadSource);
      setSourceState({ status: "ready", content });
    } catch {
      setSourceState({ status: "error" });
    }
  };

  const handleOpenChange = (value: string | undefined) => {
    setOpenValue(value ?? "");
    if (value === "source") void requestSource();
  };

  const resolvedCopyButton =
    copyButton ??
    (loadedContent?.copyText ? (
      <CopyButton
        text={loadedContent.copyText}
        label={copyLabel ?? "Copy Source"}
        {...(copyTitle ? { title: copyTitle } : {})}
      />
    ) : undefined);
  const displayedFileCount = files.length || (isLazy ? (props.fileCount ?? 0) : 0);
  const defaultLabel = (
    <>
      View component source
      {displayedFileCount > 1 ? ` (${String(displayedFileCount)} files)` : ""}
    </>
  );
  const showFileHeaders = !(files.length === 1 && triggerLabel && resolvedCopyButton);
  const isOpen = openValue === "source";
  const isLoading = isLazy && sourceState.status === "loading";
  const hasLoadError = isLazy && sourceState.status === "error";
  const hasContent = !isLazy || sourceState.status === "ready";

  return (
    <div className="mb-8">
      {showHeading && <SourceHeading>{resolvedCopyButton}</SourceHeading>}
      {(installCommand || integrationNote) && (
        <Typography as="p" size="sm" className="mb-3 mt-1">
          {installCommand && (
            <>
              Install via CLI: <InlineCode>{installCommand}</InlineCode>.
            </>
          )}
          {installCommand && integrationNote && " "}
          {integrationNote}
        </Typography>
      )}

      <Accordion collapsible value={openValue} onChange={handleOpenChange} className="divide-y-0">
        <AccordionItem value="source" className="py-0">
          {!showHeading && (resolvedCopyButton || description) ? (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <AccordionTrigger variant="source">{triggerLabel ?? defaultLabel}</AccordionTrigger>
                {description && (
                  <p className="text-xs text-muted-foreground -mt-1 mb-2">{description}</p>
                )}
              </div>
              {resolvedCopyButton}
            </div>
          ) : (
            <AccordionTrigger variant="source">{triggerLabel ?? defaultLabel}</AccordionTrigger>
          )}
          {sourceHref && (
            <p className="mb-2 text-xs text-muted-foreground">
              Highlighted source loads after this disclosure opens.{" "}
              <a className="underline" href={sourceHref}>
                Browse the source repository.
              </a>
            </p>
          )}
          <AccordionContent className="space-y-4">
            {isOpen && isLoading && (
              <output aria-live="polite" className="text-xs text-muted-foreground">
                Loading source...
              </output>
            )}
            {isOpen && hasLoadError && (
              <div className="space-y-2">
                <p role="alert" className="text-xs text-error-text">
                  Source could not be loaded.
                </p>
                <button
                  type="button"
                  className="text-xs font-mono underline"
                  onClick={() => void requestSource()}
                >
                  Retry
                </button>
              </div>
            )}
            {isOpen &&
              hasContent &&
              files.map((file) => (
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
