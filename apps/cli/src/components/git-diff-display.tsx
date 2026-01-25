import { classifyDiffLine, type DiffLineType } from "@repo/core/diff";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { GitDiffState } from "../hooks/use-git-diff.js";
import { useTheme, type ThemeColors } from "../hooks/use-theme.js";

const MAX_DIFF_LINES_DISPLAY = 50;

function getDiffLineColor(colors: ThemeColors, lineType: DiffLineType): string | undefined {
  switch (lineType) {
    case "addition":
      return colors.diff.addition;
    case "deletion":
      return colors.diff.deletion;
    case "hunk-header":
      return colors.diff.hunkHeader;
    case "file-header":
      return undefined;
    case "context":
      return colors.diff.context;
  }
}

function DiffLine({ line, colors }: { line: string; colors: ThemeColors }): React.ReactNode {
  const lineType = classifyDiffLine(line);
  const color = getDiffLineColor(colors, lineType);
  const isBold = lineType === "file-header";

  return <Text color={color} bold={isBold}>{line}</Text>;
}

export function GitDiffDisplay({
  state,
  staged,
}: {
  state: GitDiffState;
  staged: boolean;
}) {
  const { colors } = useTheme();

  if (state.status === "loading") {
    return (
      <Box>
        <Spinner type="dots" />
        <Text> Loading diff...</Text>
      </Box>
    );
  }

  if (state.status === "error") {
    return <Text color={colors.ui.error}>Error: {state.error.message}</Text>;
  }

  if (state.status !== "success") {
    return <Text color={colors.ui.textMuted}>Press 'r' to load</Text>;
  }

  const { data } = state;
  const isEmpty = data.diff.trim().length === 0;

  if (isEmpty) {
    return (
      <Text color={colors.ui.success}>
        No {staged ? "staged" : "unstaged"} changes
      </Text>
    );
  }

  const lines = data.diff.split("\n");
  const headerColor = staged ? colors.ui.success : colors.ui.warning;

  return (
    <Box flexDirection="column">
      <Text bold color={headerColor}>
        {staged ? "Staged" : "Unstaged"} Changes
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {lines.slice(0, MAX_DIFF_LINES_DISPLAY).map((line, i) => (
          <DiffLine key={i} line={line} colors={colors} />
        ))}
        {lines.length > MAX_DIFF_LINES_DISPLAY && (
          <Text color={colors.ui.textMuted}>
            ... ({lines.length - MAX_DIFF_LINES_DISPLAY} more lines)
          </Text>
        )}
      </Box>
    </Box>
  );
}
