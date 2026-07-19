import { sanitizeTerminalText } from "@diffgazer/core/review";
import { Box, type DOMElement, Text, useBoxMetrics } from "ink";
import { useRef } from "react";
import { useTheme } from "../../../theme/provider";

export interface CodeSnippetProps {
  filePath: string;
  startLine?: number;
  code: string;
}

export function CodeSnippet({ filePath, startLine, code }: CodeSnippetProps) {
  const { tokens } = useTheme();
  const containerRef = useRef<DOMElement>(null);
  const { width, hasMeasured } = useBoxMetrics(containerRef);
  const contentWidth = hasMeasured ? Math.max(width - 2, 1) : undefined;
  const lines = sanitizeTerminalText(code).split("\n");
  const safeFilePath = sanitizeTerminalText(filePath);
  const hasLineNumbers = startLine !== undefined;

  return (
    <Box ref={containerRef} flexDirection="column" borderStyle="round" borderColor={tokens.border}>
      <Box marginBottom={1}>
        <Text color={tokens.accent}>{safeFilePath}</Text>
      </Box>
      {lines.map((line, i) => {
        const absoluteLine = hasLineNumbers ? startLine + i : undefined;
        const lineNum = absoluteLine === undefined ? null : String(absoluteLine).padStart(4, " ");
        return (
          <Box key={`${i}-${line}`} width={contentWidth} height={1} overflow="hidden">
            <Text wrap="truncate-end">
              {lineNum ? <Text color={tokens.muted}>{lineNum}</Text> : null}
              {lineNum ? ` ${line}` : line}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
