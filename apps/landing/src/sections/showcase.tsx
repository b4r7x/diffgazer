import { CodeBlock } from "@diffgazer/ui/components/code-block";
import { DiffView } from "@diffgazer/ui/components/diff-view";
import { Kbd } from "@diffgazer/ui/components/kbd";
import {
  DIFF_STATS,
  SAMPLE_PATCH,
  SHOWCASE_CAPTION,
  SHOWCASE_HEADING,
  TERMINAL_OUTPUT,
  TERMINAL_TITLE,
} from "../content";

export function Showcase() {
  return (
    <section aria-labelledby="showcase-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h2
          id="showcase-heading"
          className="font-mono text-2xl font-bold text-foreground"
        >
          {SHOWCASE_HEADING}
        </h2>
        <p className="mx-auto max-w-xl font-sans text-muted-foreground">
          {SHOWCASE_CAPTION}
        </p>
      </div>

      <DiffView
        patch={SAMPLE_PATCH}
        variant="statusbar"
        statusBar={
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <span className="font-mono">{DIFF_STATS}</span>
            <span className="flex items-center gap-2">
              <Kbd size="sm">j</Kbd>
              <Kbd size="sm">k</Kbd>
              <span>navigate</span>
            </span>
          </div>
        }
      />

      <CodeBlock variant="terminal" language="bash">
        <CodeBlock.Header>
          <CodeBlock.Label>{TERMINAL_TITLE}</CodeBlock.Label>
        </CodeBlock.Header>
        <CodeBlock.Content showLineNumbers={false}>
          {TERMINAL_OUTPUT}
        </CodeBlock.Content>
      </CodeBlock>
    </section>
  );
}
