import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { Button } from "@diffgazer/ui/components/button";
import { CodeBlock } from "@diffgazer/ui/components/code-block";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { downloadAsFile } from "@/utils/download";

interface ContextSnapshotPreviewProps {
  snapshot: ReviewContextResponse;
}

export function ContextSnapshotPreview({ snapshot }: ContextSnapshotPreviewProps) {
  const lines = snapshot.text.split("\n");
  const contextPreview = {
    preview: lines.slice(0, 10).join("\n"),
    truncated: lines.length > 10,
  };

  return (
    <div className="mb-8">
      <SectionHeader variant="muted" bordered>
        Context Snapshot
      </SectionHeader>
      <div className="text-xs text-muted-foreground">
        {snapshot.meta.charCount.toLocaleString()} chars
      </div>
      <CodeBlock label="Context snapshot preview" className="mt-3">
        <CodeBlock.Content
          showLineNumbers={false}
          className="max-h-28 text-2xs text-muted-foreground"
        >
          {contextPreview.preview}
          {contextPreview.truncated ? "\n... (preview)" : ""}
        </CodeBlock.Content>
      </CodeBlock>
      <div className="flex gap-2 mt-3">
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
      </div>
    </div>
  );
}
