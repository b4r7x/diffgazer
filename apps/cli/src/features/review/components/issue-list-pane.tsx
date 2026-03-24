import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { IssuePreviewItem } from "./issue-preview-item.js";

interface Issue {
  id: string;
  severity: string;
  filePath: string;
  title: string;
}

export interface IssueListPaneProps {
  issues: Issue[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
  height?: number;
}

export function IssueListPane({
  issues,
  selectedId,
  onSelect,
  onHighlightChange,
  isActive = false,
  height = 15,
}: IssueListPaneProps) {
  const { tokens } = useTheme();
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useInput(
    (input, key) => {
      if (issues.length === 0) return;

      if (key.downArrow || input === "j") {
        const nextIndex = Math.min(highlightedIndex + 1, issues.length - 1);
        setHighlightedIndex(nextIndex);
        const issue = issues[nextIndex];
        if (issue) {
          onHighlightChange?.(issue.id);
        }
        return;
      }

      if (key.upArrow || input === "k") {
        const nextIndex = Math.max(highlightedIndex - 1, 0);
        setHighlightedIndex(nextIndex);
        const issue = issues[nextIndex];
        if (issue) {
          onHighlightChange?.(issue.id);
        }
        return;
      }

      if (key.return) {
        const issue = issues[highlightedIndex];
        if (issue) {
          onSelect?.(issue.id);
        }
        return;
      }
    },
    { isActive },
  );

  if (issues.length === 0) {
    return (
      <Box flexDirection="column">
        <SectionHeader>Issues</SectionHeader>
        <Text color={tokens.muted}>No issues found</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <SectionHeader bordered>
        {`Issues (${issues.length})`}
      </SectionHeader>
      <ScrollArea height={height} isActive={false}>
        {issues.map((issue, index) => (
          <Box key={issue.id}>
            <Text color={selectedId === issue.id ? tokens.accent : tokens.muted}>
              {selectedId === issue.id ? "│ " : "  "}
            </Text>
            <IssuePreviewItem
              severity={issue.severity}
              filePath={issue.filePath}
              title={issue.title}
              isHighlighted={index === highlightedIndex}
            />
          </Box>
        ))}
      </ScrollArea>
    </Box>
  );
}
