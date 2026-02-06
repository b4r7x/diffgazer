import { useMemo } from "react";
import { PanelHeader } from "@/components/ui/containers";
import { downloadAsFile } from "@/utils/download";
import type { ReviewContextResponse } from "@stargazer/api/types";

interface ContextSnapshotPreviewProps {
  snapshot: ReviewContextResponse;
}

export function ContextSnapshotPreview({ snapshot }: ContextSnapshotPreviewProps) {
  const contextPreview = useMemo(() => {
    const lines = snapshot.text.split("\n");
    return {
      preview: lines.slice(0, 10).join("\n"),
      truncated: lines.length > 10,
    };
  }, [snapshot]);

  return (
    <div className="mb-8">
      <PanelHeader variant="section-bordered">Context Snapshot</PanelHeader>
      <div className="text-xs text-gray-500">
        {snapshot.meta.charCount.toLocaleString()} chars
      </div>
      <pre className="mt-3 max-h-28 overflow-auto border border-tui-border bg-tui-selection/10 p-2 text-[10px] text-gray-500">
        {contextPreview.preview}
        {contextPreview.truncated ? "\n... (preview)" : ""}
      </pre>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => downloadAsFile(snapshot.text, "context.txt", "text/plain")}
          className="px-3 py-1 border border-tui-border text-xs font-mono hover:bg-tui-selection/30"
        >
          [ Download .txt ]
        </button>
        <button
          type="button"
          onClick={() => downloadAsFile(snapshot.markdown, "context.md", "text/markdown")}
          className="px-3 py-1 border border-tui-border text-xs font-mono hover:bg-tui-selection/30"
        >
          [ Download .md ]
        </button>
        <button
          type="button"
          onClick={() =>
            downloadAsFile(JSON.stringify(snapshot.graph, null, 2), "context.json", "application/json")
          }
          className="px-3 py-1 border border-tui-border text-xs font-mono hover:bg-tui-selection/30"
        >
          [ Download .json ]
        </button>
      </div>
    </div>
  );
}
