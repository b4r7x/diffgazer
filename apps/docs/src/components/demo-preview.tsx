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
import { Spinner } from "@diffgazer/ui/components/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@diffgazer/ui/components/tabs";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import {
  Component,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
  Suspense,
  useRef,
  useState,
} from "react";
import { CopyButton } from "@/components/copy-button";
import { InsetPreviewPane } from "@/components/inset-preview-pane";
import { type PreviewMode, usePreviewMode } from "@/components/preview-mode-context";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { DOT_GRID_CLASS } from "@/components/shared/dot-grid";
import { useTheme } from "@/hooks/theme-context";
import type { PreviewFrame } from "@/lib/example-frames";

interface DemoPreviewProps {
  title?: string;
  demo: LazyExoticComponent<ComponentType> | null;
  code: CodeBlockLineProps[];
  rawCode: string;
  frame?: PreviewFrame;
}

const EMPTY_FALLBACK = <div aria-hidden="true" className="h-full w-full" />;

const LOADING_FALLBACK = (
  <div className="flex h-full w-full items-center justify-center">
    <Spinner variant="pulse" size="sm" />
  </div>
);

class DemoPreviewErrorBoundary extends Component<
  Readonly<{ children: ReactNode }>,
  Readonly<{ failed: boolean }>
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <output className="flex min-h-[120px] items-center justify-center text-sm">
          Preview unavailable.
        </output>
      );
    }
    return this.props.children;
  }
}

function DemoNode({ demo: Demo }: { demo: LazyExoticComponent<ComponentType> | null }) {
  if (!Demo) return EMPTY_FALLBACK;
  return (
    <Suspense fallback={LOADING_FALLBACK}>
      <Demo />
    </Suspense>
  );
}

function DefaultPreviewPane({
  demo,
  rawCode,
  theme,
  compact = false,
}: {
  demo: LazyExoticComponent<ComponentType> | null;
  rawCode: string;
  theme: string;
  compact?: boolean;
}) {
  return (
    <div data-demo-preview data-theme={theme}>
      <Panel frame="viewfinder">
        {/* The header slot is used directly (not PanelHeader) so the lone label
            stays left-aligned; PanelHeader routes a plain child to its right
            end slot. The slot still gives the viewfinder hairline + density. */}
        <div data-slot="panel-header">
          <span className={CHROME_LABEL_CLASS}>Preview</span>
        </div>
        {/* The stage scrolls its own overflow so wide demos never pan the page. */}
        <ScrollArea
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
            <DemoNode demo={demo} />
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
}: {
  demo: LazyExoticComponent<ComponentType> | null;
  theme: string;
}) {
  return (
    <ScrollArea
      orientation="horizontal"
      aria-label="Example preview"
      data-demo-preview
      data-theme={theme}
      className="border border-border bg-background"
    >
      <div className="w-full [&>*]:w-full">
        <DemoNode demo={demo} />
      </div>
    </ScrollArea>
  );
}

function PreviewPane({
  demo,
  frame,
  rawCode,
}: {
  demo: LazyExoticComponent<ComponentType> | null;
  frame: PreviewFrame;
  rawCode: string;
}) {
  const { resolved: theme } = useTheme();
  if (frame === "inset") {
    return (
      <div data-demo-preview data-theme={theme}>
        <InsetPreviewPane demo={demo} />
      </div>
    );
  }
  if (frame === "fill") return <FillPreviewPane demo={demo} theme={theme} />;
  if (frame === "default" || frame === "compact")
    return (
      <DefaultPreviewPane
        demo={demo}
        rawCode={rawCode}
        theme={theme}
        compact={frame === "compact"}
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

export function DemoPreview({ title, demo, code, rawCode, frame = "default" }: DemoPreviewProps) {
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
    <div ref={rootRef} className="mb-6">
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
          <DemoPreviewErrorBoundary>
            <PreviewPane demo={demo} frame={frame} rawCode={rawCode} />
          </DemoPreviewErrorBoundary>
        </TabsContent>
        <TabsContent value="code">
          <CodePane code={code} rawCode={rawCode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
