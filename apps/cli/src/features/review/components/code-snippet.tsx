import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";

export interface CodeSnippetProps {
  filePath: string;
  startLine?: number;
  code: string;
}

export function CodeSnippet({ filePath, startLine = 1, code }: CodeSnippetProps) {
  const { tokens } = useTheme();
  const lines = code.split("\n");

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={tokens.border}
    >
      <Box marginBottom={1}>
        <Text color={tokens.accent}>{filePath}</Text>
      </Box>
      {lines.map((line, i) => {
        const lineNum = String(startLine + i).padStart(4, " ");
        return (
          <Box key={i} gap={1}>
            <Text color={tokens.muted}>{lineNum}</Text>
            <Text>{line}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
