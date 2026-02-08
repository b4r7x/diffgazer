import { PanelHeader, Button } from "@stargazer/ui";
import { downloadAsFile } from "@/utils/download";
import type { ReviewContextResponse } from "@stargazer/api/types";

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
      <PanelHeader variant="section-bordered">Context Snapshot</PanelHeader>
      <div className="text-xs text-tui-muted">
        {snapshot.meta.charCount.toLocaleString()} chars
      </div>
      <pre className="mt-3 max-h-28 overflow-auto border border-tui-border bg-tui-selection/10 p-2 text-[10px] text-tui-muted">
        {contextPreview.preview}
        {contextPreview.truncated ? "\n... (preview)" : ""}
      </pre>
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
            downloadAsFile(JSON.stringify(snapshot.graph, null, 2), "context.json", "application/json")
          }
        >
          Download .json
        </Button>
      </div>
    </div>
  );
}
