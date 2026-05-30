import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { NavigationList } from "../../../components/ui/navigation-list";
import { EmptyState } from "../../../components/ui/empty-state";
import { Badge } from "../../../components/ui/badge";
import { useTheme } from "../../../theme/theme-context";
import type { MappedRun } from "../hooks/use-history-screen";

export interface RunsListProps {
  runs: MappedRun[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
  emptyMessage: string;
}

export function RunsList({
  runs,
  selectedId,
  onSelect,
  onHighlightChange,
  isActive = true,
  emptyMessage,
}: RunsListProps): ReactElement {
  const { tokens } = useTheme();

  if (runs.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <EmptyState>
          <EmptyState.Message>{emptyMessage}</EmptyState.Message>
        </EmptyState>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <NavigationList
        selectedId={selectedId}
        highlightedId={isActive ? selectedId : null}
        onSelect={onSelect}
        onHighlightChange={onHighlightChange}
        isActive={isActive}
        wrap={false}
      >
        {runs.map((run) => (
          <NavigationList.Item key={run.id} id={run.id}>
            <Box flexDirection="column">
              <Box flexDirection="row" gap={1}>
                <NavigationList.Title>{run.displayId}</NavigationList.Title>
                <Badge variant="neutral">{run.branch}</Badge>
                <Box flexGrow={1} />
                <Text color={tokens.muted}>{run.timestamp}</Text>
              </Box>
              <Box flexDirection="row">
                <Text color={tokens.muted}>{run.summary}</Text>
              </Box>
            </Box>
          </NavigationList.Item>
        ))}
      </NavigationList>
    </Box>
  );
}
