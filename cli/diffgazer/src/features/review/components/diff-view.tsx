import { sanitizeTerminalText } from "@diffgazer/core/review";
import { Box, type DOMElement, Text, useBoxMetrics } from "ink";
import { useRef } from "react";
import { useTheme } from "../../../theme/provider";

export interface DiffViewProps {
  patch: string;
}

export function DiffView({ patch }: DiffViewProps) {
  const { tokens } = useTheme();
  const containerRef = useRef<DOMElement>(null);
  const { width, hasMeasured } = useBoxMetrics(containerRef);
  const contentWidth = hasMeasured ? Math.max(width - 2, 1) : undefined;

  // Defense-in-depth: the server already sanitizes suggested_patch, but strip any
  // residual terminal-escape sequences before rendering into the raw terminal.
  const lines = sanitizeTerminalText(patch).split("\n");

  return (
    <Box ref={containerRef} flexDirection="column" borderStyle="round" borderColor={tokens.border}>
      {lines.map((line, i) => {
        let color = tokens.fg;
        if (line.startsWith("--- ") || line.startsWith("+++ ")) {
          color = tokens.muted;
        } else if (line.startsWith("@@")) {
          color = tokens.accent;
        } else if (line.startsWith("+")) {
          color = tokens.success;
        } else if (line.startsWith("-")) {
          color = tokens.error;
        }

        return (
          <Box
            key={`${i}:${line}`}
            width={contentWidth}
            height={1}
            overflow="hidden"
            flexWrap="nowrap"
          >
            <Text color={color} wrap="truncate-end">
              {line}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
