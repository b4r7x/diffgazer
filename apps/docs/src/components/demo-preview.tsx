import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockLabel,
  CodeBlockLine,
  type CodeBlockLineProps,
} from "@diffgazer/ui/components/code-block";
import { Panel, PanelFooter } from "@diffgazer/ui/components/panel";
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
} from "react";
import { CopyButton } from "@/components/copy-button";
import { InsetPreviewPane } from "@/components/preview-inset-pane";
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
}: {
  demo: LazyExoticComponent<ComponentType> | null;
  rawCode: string;
  theme: string;
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
        <div
          className={cn(
            DOT_GRID_CLASS,
            "flex min-h-[240px] items-center justify-center px-8 py-12",
          )}
        >
          <DemoNode demo={demo} />
        </div>
        {rawCode.length > 0 && (
          <PanelFooter>
            <CopyButton text={rawCode} label="copy jsx" className="ml-auto uppercase" />
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
    <div data-demo-preview data-theme={theme} className="border border-border bg-background">
      <div className="w-full [&>*]:w-full">
        <DemoNode demo={demo} />
      </div>
    </div>
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
  const { theme } = useTheme();
  if (frame === "inset") {
    return (
      <div data-demo-preview data-theme={theme}>
        <InsetPreviewPane demo={demo} />
      </div>
    );
  }
  if (frame === "fill") return <FillPreviewPane demo={demo} theme={theme} />;
  if (frame === "default")
    return <DefaultPreviewPane demo={demo} rawCode={rawCode} theme={theme} />;
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
  return (
    <div className="mb-6">
      {title && (
        <Typography
          as="h4"
          size="base"
          className="text-foreground font-bold uppercase tracking-wider mb-2"
        >
          {title}
        </Typography>
      )}
      <Tabs defaultValue="preview" variant="underline" size="sm">
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
