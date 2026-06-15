import type { CategoryStats } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/provider";

export type { CategoryStats };

export interface CategoryStatsTableProps {
  categories: CategoryStats[];
}

export function CategoryStatsTable({ categories }: CategoryStatsTableProps) {
  const { tokens } = useTheme();

  if (categories.length === 0) {
    return <Text color={tokens.muted}>No category data</Text>;
  }

  const nameWidth = Math.max("Category".length, ...categories.map((c) => c.name.length));

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={tokens.muted} bold>
          {"Category".padEnd(nameWidth)}
        </Text>
        <Text color={tokens.muted} bold>
          Count
        </Text>
      </Box>
      {categories.map((category) => (
        <Box key={category.id} gap={1}>
          <Text color={tokens.fg}>{category.name.padEnd(nameWidth)}</Text>
          <Text color={tokens.fg} bold>
            {String(category.count)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
