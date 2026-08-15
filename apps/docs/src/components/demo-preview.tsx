import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockLabel,
  CodeBlockLine,
  type CodeBlockLineProps,
} from "@diffgazer/ui/components/code-block";
import { Panel, PanelFooter } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@diffgazer/ui/components/tabs";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import { type ComponentType, type LazyExoticComponent, useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { DemoNode } from "@/components/demo-node";
import { InsetPreviewPane } from "@/components/inset-preview-pane";
import { type PreviewMode, usePreviewMode } from "@/components/preview-mode-context";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { DOT_GRID_CLASS } from "@/components/shared/dot-grid";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { useTheme } from "@/hooks/theme-context";
import { useIsScrollable } from "@/hooks/use-is-scrollable";
import type { PreviewFrame } from "@/lib/example-frames";

interface DemoPreviewProps {
  title?: string;
  demo: LazyExoticComponent<ComponentType> | null;
  loading?: boolean;
  /** Set when the library demo index failed to load. */
  loadError?: Error | null;
  /** Retries the demo-index import after a load failure. */
  onRetryLoad?: () => void;
  code: CodeBlockLineProps[];
  rawCode: string;
  frame?: PreviewFrame;
}

export function PreviewUnavailable({
  loadError,
  onRetryLoad,
}: {
  loadError?: Error | null;
  onRetryLoad?: () => void;
}) {
  return (
    <output
      className="flex min-h-[120px] flex-col items-center justify-center gap-2 px-4 text-center text-sm"
      data-demo-load-error={loadError?.message ?? "demo-index-unavailable"}
    >
      <span>Preview unavailable.</span>
      {onRetryLoad ? (
        <button
          type="button"
          className="font-mono text-xs uppercase tracking-wider text-muted-foreground underline-offset-2 hover:underline"
          onClick={onRetryLoad}
        >
          Retry preview
        </button>
      ) : null}
    </output>
  );
}

function DefaultPreviewPane({
  demo,
  rawCode,
  theme,
  compact = false,
  loading = false,
  loadError = null,
  onRetryLoad,
}: {
  demo: LazyExoticComponent<ComponentType> | null;
  rawCode: string;
  theme: string;
  compact?: boolean;
  loading?: boolean;
  loadError?: Error | null;
  onRetryLoad?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const isScrollable = useIsScrollable(stageRef);

  return (
    <div data-demo-preview data-theme={theme}>
      {/* The stage wears the plain hairline frame so a rendered example shows
          only its own chrome — a bracketed demo is never staged inside a second
          set of brackets at another stroke weight. */}
      <Panel frame="hairline">
        {/* The header slot is used directly (not PanelHeader) so the lone label
            stays left-aligned; PanelHeader routes a plain child to its right
            end slot. The slot still gives the frame hairline + density. */}
        <div data-slot="panel-header">
          <span className={CHROME_LABEL_CLASS}>Preview</span>
        </div>
        {/* The stage scrolls its own overflow so wide demos never pan the page,
            and takes a tab stop only while it actually has something to scroll. */}
        <ScrollArea
          ref={stageRef}
          tabIndex={isScrollable ? 0 : -1}
          orientation="horizontal"
          aria-label="Example preview"
          className={cn(DOT_GRID_CLASS, "flex min-w-0", compact ? "min-h-[96px]" : "min-h-[240px]")}
        >
          <div
            className={cn(
              "flex w-full items-center justify-center-safe px-8",
              compact ? "py-6" : "py-12",
            )}
          >
            {loadError ? (
              <PreviewUnavailable loadError={loadError} onRetryLoad={onRetryLoad} />
            ) : (
              <DemoNode demo={demo} loading={loading} />
            )}
          </div>
        </ScrollArea>
        {rawCode.length > 0 && (
          <PanelFooter>
            <CopyButton text={rawCode} label="copy tsx" className="ml-auto uppercase" />
          </PanelFooter>
        )}
      </Panel>
    </div>
  );
}

function FillPreviewPane({
  demo,
  theme,
  loading = false,
  loadError = null,
  onRetryLoad,
}: {
  demo: LazyExoticComponent<ComponentType> | null;
  theme: string;
  loading?: boolean;
  loadError?: Error | null;
  onRetryLoad?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const isScrollable = useIsScrollable(stageRef);

  return (
    <ScrollArea
      ref={stageRef}
      tabIndex={isScrollable ? 0 : -1}
      orientation="horizontal"
      aria-label="Example preview"
      data-demo-preview
      data-theme={theme}
      className="border border-border bg-background"
    >
      <div className="w-full [&>*]:w-full">
        {loadError ? (
          <PreviewUnavailable loadError={loadError} onRetryLoad={onRetryLoad} />
        ) : (
          <DemoNode demo={demo} loading={loading} />
        )}
      </div>
    </ScrollArea>
  );
}

function PreviewPane({
  demo,
  frame,
  rawCode,
  loading = false,
  loadError = null,
  onRetryLoad,
}: {
  demo: LazyExoticComponent<ComponentType> | null;
  frame: PreviewFrame;
  rawCode: string;
  loading?: boolean;
  loadError?: Error | null;
  onRetryLoad?: () => void;
}) {
  const { theme } = useTheme();
  if (frame === "inset") {
    return (
      <div data-demo-preview data-theme={theme}>
        <InsetPreviewPane
          demo={demo}
          loading={loading}
          loadError={loadError}
          onRetryLoad={onRetryLoad}
        />
      </div>
    );
  }
  if (frame === "fill")
    return (
      <FillPreviewPane
        demo={demo}
        theme={theme}
        loading={loading}
        loadError={loadError}
        onRetryLoad={onRetryLoad}
      />
    );
  if (frame === "default" || frame === "compact")
    return (
      <DefaultPreviewPane
        demo={demo}
        rawCode={rawCode}
        theme={theme}
        compact={frame === "compact"}
        loading={loading}
        loadError={loadError}
        onRetryLoad={onRetryLoad}
      />
    );
  frame satisfies never;
  return null;
}

function CodePane({ code, rawCode }: { code: CodeBlockLineProps[]; rawCode: string }) {
  return (
    <CodeBlock className="rounded-none">
      <CodeBlockHeader>
        <CodeBlockLabel>tsx</CodeBlockLabel>
        <CopyButton text={rawCode} />
      </CodeBlockHeader>
      <CodeBlockContent>
        {code.map((line) => (
          <CodeBlockLine key={line.number} {...line} />
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}

export function DemoPreview({
  title,
  demo,
  loading = false,
  loadError = null,
  onRetryLoad,
  code,
  rawCode,
  frame = "default",
}: DemoPreviewProps) {
  const shared = usePreviewMode();
  const [localMode, setLocalMode] = useState<PreviewMode>("preview");
  const rootRef = useRef<HTMLDivElement>(null);
  // Outside a docs page (MDX placements, unit tests) the strip is its own
  // uncontrolled pair; inside one, every strip reads the page's single value.
  const mode = shared?.mode ?? localMode;

  const onModeChange = (next: PreviewMode) => {
    if (shared) shared.setMode(next, rootRef.current);
    else setLocalMode(next);
  };

  return (
    <div ref={rootRef} data-slot="demo-preview" className="mb-6">
      {title && (
        <Typography
          as="h4"
          size="base"
          className="text-foreground font-bold uppercase tracking-wider mb-2"
        >
          {title}
        </Typography>
      )}
      <Tabs value={mode} onChange={onModeChange} variant="underline" size="sm">
        <TabsList className="mb-3">
          <TabsTrigger value="preview" className="text-xs">
            Preview
          </TabsTrigger>
          <TabsTrigger value="code" className="text-xs">
            Code
          </TabsTrigger>
        </TabsList>
        <TabsContent value="preview">
          <ErrorBoundary fallback={<PreviewUnavailable />}>
            <PreviewPane
              demo={demo}
              frame={frame}
              rawCode={rawCode}
              loading={loading}
              loadError={loadError}
              onRetryLoad={onRetryLoad}
            />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="code">
          <CodePane code={code} rawCode={rawCode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
