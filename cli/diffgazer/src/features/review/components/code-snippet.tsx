import { sanitizeTerminalText } from "@diffgazer/core/review";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/provider";

export interface CodeSnippetProps {
  filePath: string;
  startLine?: number;
  code: string;
}

export function CodeSnippet({ filePath, startLine, code }: CodeSnippetProps) {
  const { tokens } = useTheme();
  const lines = sanitizeTerminalText(code).split("\n");
  const safeFilePath = sanitizeTerminalText(filePath);
  const hasLineNumbers = startLine !== undefined;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={tokens.border}>
      <Box marginBottom={1}>
        <Text color={tokens.accent}>{safeFilePath}</Text>
      </Box>
      {lines.map((line, i) => {
        const absoluteLine = hasLineNumbers ? startLine + i : undefined;
        const lineNum = absoluteLine === undefined ? null : String(absoluteLine).padStart(4, " ");
        return (
          <Box key={`${i}-${line}`} gap={1}>
            {lineNum ? <Text color={tokens.muted}>{lineNum}</Text> : null}
            <Text>{line}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
