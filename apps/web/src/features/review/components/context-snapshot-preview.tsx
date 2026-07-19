import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { buildContextSnapshotView } from "@diffgazer/core/review";
import { pluralize } from "@diffgazer/core/strings";
import { Button } from "@diffgazer/ui/components/button";
import { CodeBlock } from "@diffgazer/ui/components/code-block";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { downloadAsFile } from "@/utils/download";

interface ContextSnapshotPreviewProps {
  snapshot: ReviewContextResponse;
}

export function ContextSnapshotPreview({ snapshot }: ContextSnapshotPreviewProps) {
  const view = buildContextSnapshotView(snapshot);

  return (
    <div className="mb-8">
      <SectionHeader variant="muted" bordered>
        Context Snapshot
      </SectionHeader>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline">Project: </dt>
          <dd className="inline text-foreground">{view.project}</dd>
        </div>
        <div>
          <dt className="sr-only">Changed files</dt>
          <dd>{pluralize(view.changedFileCount, "changed file")}</dd>
        </div>
        <div>
          <dt className="sr-only">Diff totals</dt>
          <dd>
            +{view.additions} / -{view.deletions}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Packages</dt>
          <dd>{pluralize(view.packageCount, "package")}</dd>
        </div>
        <div>
          <dt className="sr-only">Context size</dt>
          <dd>{view.charCount.toLocaleString()} chars</dd>
        </div>
      </dl>
      <CodeBlock label="Context snapshot preview" className="mt-3">
        <CodeBlock.Content
          showLineNumbers={false}
          className="max-h-28 text-2xs text-muted-foreground"
        >
          {view.previewLines.join("\n")}
          {view.previewTruncated ? "\n... (preview)" : ""}
        </CodeBlock.Content>
      </CodeBlock>
      <fieldset className="mt-3 flex flex-wrap gap-2">
        <legend className="sr-only">Download context snapshot</legend>
        <Button
          variant="secondary"
          size="sm"
          bracket
          onClick={() => downloadAsFile(snapshot.text, "context.txt", "text/plain")}
        >
          Download .txt
        </Button>
        <Button
          variant="secondary"
          size="sm"
          bracket
          onClick={() => downloadAsFile(snapshot.markdown, "context.md", "text/markdown")}
        >
          Download .md
        </Button>
        <Button
          variant="secondary"
          size="sm"
          bracket
          onClick={() =>
            downloadAsFile(
              JSON.stringify(snapshot.graph, null, 2),
              "context.json",
              "application/json",
            )
          }
        >
          Download .json
        </Button>
      </fieldset>
    </div>
  );
}
