import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { TriageSeverity, TriageCategory } from "@repo/schemas/triage";
import type { LensId } from "@repo/schemas/lens";
import { Badge } from "../../../../components/ui/badge.js";

export type IssueStatus = "all" | "pending" | "applied" | "ignored";

interface FilterState {
  severity: TriageSeverity | "all";
  lens: LensId | "all";
  status: IssueStatus;
  search: string;
}

interface IssueListHeaderProps {
  filters: FilterState;
  totalCount: number;
  filteredCount: number;
}

const SEVERITY_COLORS: Record<TriageSeverity | "all", string> = {
  all: "white",
  blocker: "red",
  high: "magenta",
  medium: "yellow",
  low: "blue",
  nit: "gray",
};

const STATUS_COLORS: Record<IssueStatus, string> = {
  all: "white",
  pending: "yellow",
  applied: "green",
  ignored: "gray",
};

export function IssueListHeader({
  filters,
  totalCount,
  filteredCount,
}: IssueListHeaderProps): ReactElement {
  const hasFilters =
    filters.severity !== "all" ||
    filters.lens !== "all" ||
    filters.status !== "all" ||
    filters.search.length > 0;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold>Issues</Text>
        <Text dimColor>
          ({filteredCount}
          {hasFilters ? `/${totalCount}` : ""})
        </Text>
      </Box>

      <Box flexDirection="row" gap={1} marginTop={1}>
        <Text dimColor>Filters:</Text>
        <Badge
          text={filters.severity === "all" ? "All" : filters.severity.toUpperCase()}
          color={SEVERITY_COLORS[filters.severity]}
        />
        {filters.lens !== "all" && (
          <Badge text={filters.lens} variant="info" />
        )}
        {filters.status !== "all" && (
          <Badge
            text={filters.status}
            color={STATUS_COLORS[filters.status]}
          />
        )}
        {filters.search && (
          <Text dimColor>"{filters.search}"</Text>
        )}
      </Box>
    </Box>
  );
}

export type { FilterState };
