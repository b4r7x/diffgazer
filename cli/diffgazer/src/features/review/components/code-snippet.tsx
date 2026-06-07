import { Box, Text } from "ink";
import { useTheme } from "../../../app/providers/theme";

export interface CodeSnippetProps {
  filePath: string;
  startLine?: number;
  code: string;
}

export function CodeSnippet({ filePath, startLine = 1, code }: CodeSnippetProps) {
  const { tokens } = useTheme();
  const lines = code.split("\n");

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={tokens.border}>
      <Box marginBottom={1}>
        <Text color={tokens.accent}>{filePath}</Text>
      </Box>
      {lines.map((line, i) => {
        const absoluteLine = startLine + i;
        const lineNum = String(absoluteLine).padStart(4, " ");
        return (
          <Box key={absoluteLine} gap={1}>
            <Text color={tokens.muted}>{lineNum}</Text>
            <Text>{line}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
