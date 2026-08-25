import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import { Box, type DOMElement, Text, useBoxMetrics } from "ink";
import { useRef } from "react";
import { SURFACE_BORDER } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";

export interface CodeSnippetProps {
  filePath: string;
  /**
   * One gutter number per code row. A `null` row prints an empty gutter cell so a
   * gap or truncation marker never borrows the number of code it is not. Omit to
   * render no gutter at all.
   */
  lineNumbers?: readonly (number | null)[];
  code: string;
}

export function CodeSnippet({ filePath, lineNumbers, code }: CodeSnippetProps) {
  const { tokens } = useTheme();
  const containerRef = useRef<DOMElement>(null);
  const { width, hasMeasured } = useBoxMetrics(containerRef);
  const contentWidth = hasMeasured ? Math.max(width - 2, 1) : undefined;
  const lines = sanitizeTerminalText(code).split("\n");
  const safeFilePath = sanitizeTerminalText(filePath);

  return (
    <Box
      ref={containerRef}
      flexDirection="column"
      borderStyle={SURFACE_BORDER}
      borderColor={tokens.border}
    >
      <Box marginBottom={1}>
        <Text color={tokens.accent}>{safeFilePath}</Text>
      </Box>
      {lines.map((line, i) => {
        const gutter =
          lineNumbers === undefined ? null : String(lineNumbers[i] ?? "").padStart(4, " ");
        return (
          <Box key={`${i}-${line}`} width={contentWidth} height={1} overflow="hidden">
            <Text wrap="truncate-end">
              {gutter === null ? null : <Text color={tokens.muted}>{gutter}</Text>}
              {gutter === null ? line : ` ${line}`}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
