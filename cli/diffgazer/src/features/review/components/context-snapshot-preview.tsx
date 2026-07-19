import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { buildContextSnapshotView, sanitizeTerminalText } from "@diffgazer/core/review";
import { pluralize } from "@diffgazer/core/strings";
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { KeyValue } from "../../../components/ui/key-value";
import { SectionHeader } from "../../../components/ui/section-header";
import { useTheme } from "../../../theme/provider";

interface ContextSnapshotPreviewProps {
  snapshot: ReviewContextResponse;
  outputDirectory?: string;
  compact?: boolean;
}

const SNAPSHOT_FILES = {
  text: "context.txt",
  markdown: "context.md",
  graph: "context.json",
} as const;

export async function saveContextSnapshot(
  snapshot: ReviewContextResponse,
  outputDirectory: string,
): Promise<string[]> {
  const paths = {
    text: join(outputDirectory, SNAPSHOT_FILES.text),
    markdown: join(outputDirectory, SNAPSHOT_FILES.markdown),
    graph: join(outputDirectory, SNAPSHOT_FILES.graph),
  };

  await Promise.all([
    writeFile(paths.text, snapshot.text, "utf8"),
    writeFile(paths.markdown, snapshot.markdown, "utf8"),
    writeFile(paths.graph, `${JSON.stringify(snapshot.graph, null, 2)}\n`, "utf8"),
  ]);

  return [paths.text, paths.markdown, paths.graph];
}

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; paths: string[] }
  | { status: "error"; message: string };

export function ContextSnapshotPreview({
  snapshot,
  outputDirectory = process.cwd(),
  compact = false,
}: ContextSnapshotPreviewProps) {
  const { tokens } = useTheme();
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const view = buildContextSnapshotView(snapshot);
  const preview = sanitizeTerminalText(view.previewLines.join("\n"));

  const labelWidth = 12;

  useInput(
    (input) => {
      if (input !== "w") return;

      setSaveState({ status: "saving" });
      void saveContextSnapshot(snapshot, outputDirectory)
        .then((paths) => setSaveState({ status: "saved", paths }))
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Unable to save context snapshot";
          setSaveState({ status: "error", message });
        });
    },
    { isActive: saveState.status !== "saving" },
  );

  return (
    <Box flexDirection="column">
      <SectionHeader variant="muted" bordered>
        Context Snapshot
      </SectionHeader>
      {compact ? (
        <Box paddingLeft={1}>
          <Text color={tokens.muted} wrap="truncate-end">
            {sanitizeTerminalText(view.project)} · {pluralize(view.changedFileCount, "file")} ·{" "}
            {view.charCount.toLocaleString()} chars
          </Text>
        </Box>
      ) : null}
      {!compact ? (
        <>
          <Box flexDirection="column" paddingTop={1} paddingLeft={1} gap={0}>
            <KeyValue
              label="Project"
              value={sanitizeTerminalText(view.project)}
              labelWidth={labelWidth}
            />
            <KeyValue
              label="Changed"
              value={pluralize(view.changedFileCount, "file")}
              labelWidth={labelWidth}
            />
            {(view.additions > 0 || view.deletions > 0) && (
              <KeyValue
                label="Diff"
                value={
                  <Box>
                    <Text color={tokens.success}>+{view.additions}</Text>
                    <Text color={tokens.muted}> / </Text>
                    <Text color={tokens.error}>-{view.deletions}</Text>
                  </Box>
                }
                labelWidth={labelWidth}
              />
            )}
            {view.packageCount > 0 && (
              <KeyValue label="Packages" value={`${view.packageCount}`} labelWidth={labelWidth} />
            )}
            <KeyValue
              label="Context"
              value={`${view.charCount.toLocaleString()} chars`}
              labelWidth={labelWidth}
            />
          </Box>
          <Box flexDirection="column" paddingTop={1} paddingLeft={1}>
            <Text color={tokens.muted}>{preview}</Text>
            {view.previewTruncated ? <Text color={tokens.muted}>... (preview)</Text> : null}
          </Box>
        </>
      ) : null}
      {saveState.status === "saving" ? (
        <Box paddingTop={1} paddingLeft={1}>
          <Text color={tokens.muted}>Saving context snapshot...</Text>
        </Box>
      ) : null}
      {saveState.status === "saved" ? (
        <Box flexDirection="column" paddingTop={1} paddingLeft={1}>
          {compact ? (
            <>
              <Text color={tokens.success}>Saved: context.txt</Text>
              <Text color={tokens.muted}>context.md · context.json</Text>
            </>
          ) : (
            <>
              <Text color={tokens.success}>Saved context snapshot:</Text>
              {saveState.paths.map((path) => (
                <Text key={path} color={tokens.muted} wrap="truncate-middle">
                  {sanitizeTerminalText(path)}
                </Text>
              ))}
            </>
          )}
        </Box>
      ) : null}
      {saveState.status === "error" ? (
        <Box paddingTop={1} paddingLeft={1}>
          <Text color={tokens.error} wrap="truncate-end">
            {sanitizeTerminalText(saveState.message)}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
