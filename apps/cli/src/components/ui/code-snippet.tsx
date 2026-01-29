import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export interface CodeLine {
  number: number;
  content: string;
  type?: "normal" | "added" | "removed" | "highlight";
}

export interface CodeSnippetProps {
  lines: CodeLine[];
}

export function CodeSnippet({ lines }: CodeSnippetProps): ReactElement {
  const { colors } = useTheme();

  const maxLineNum = Math.max(...lines.map((l) => l.number));
  const gutterWidth = String(maxLineNum).length;

  const getLineColor = (type?: CodeLine["type"]): string | undefined => {
    switch (type) {
      case "highlight":
        return colors.ui.error;
      case "added":
        return colors.diff.addition;
      case "removed":
        return colors.diff.deletion;
      default:
        return colors.ui.textMuted;
    }
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={colors.ui.border} paddingX={1}>
      {lines.map((line) => (
        <Box key={line.number}>
          <Text color={colors.ui.textMuted} dimColor>
            {String(line.number).padStart(gutterWidth, " ")}
          </Text>
          <Text color={colors.ui.border}> | </Text>
          <Text color={getLineColor(line.type)}>{line.content}</Text>
        </Box>
      ))}
    </Box>
  );
}
