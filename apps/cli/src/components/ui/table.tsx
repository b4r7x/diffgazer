import type { ReactElement, ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
}

export interface TableProps<T extends Record<string, ReactNode>> {
  columns: TableColumn[];
  data: T[];
  getRowKey?: (row: T, index: number) => string;
  selectedRowIndex?: number;
  onRowSelect?: (index: number) => void;
  onRowClick?: (row: T, index: number) => void;
  isActive?: boolean;
}

export function Table<T extends Record<string, ReactNode>>({
  columns,
  data,
  getRowKey,
  selectedRowIndex,
  onRowSelect,
  onRowClick,
  isActive = true,
}: TableProps<T>): ReactElement {
  const { colors } = useTheme();
  const hasSelection = selectedRowIndex !== undefined && onRowSelect;

  useInput(
    (input, key) => {
      if (!isActive || selectedRowIndex === undefined || !onRowSelect) return;

      if ((key.upArrow || input === "k") && selectedRowIndex > 0) {
        onRowSelect(selectedRowIndex - 1);
      }

      if ((key.downArrow || input === "j") && selectedRowIndex < data.length - 1) {
        onRowSelect(selectedRowIndex + 1);
      }

      if (key.return && onRowClick && selectedRowIndex < data.length) {
        const row = data[selectedRowIndex];
        if (row) {
          onRowClick(row, selectedRowIndex);
        }
      }
    },
    { isActive: isActive && selectedRowIndex !== undefined && !!onRowSelect }
  );

  const renderCell = (value: ReactNode, width?: number): ReactElement => {
    const content = typeof value === "string" || typeof value === "number" ? String(value) : value;
    if (width && typeof content === "string") {
      const truncated = content.length > width ? content.slice(0, width - 1) + "…" : content;
      return <Text>{truncated.padEnd(width)}</Text>;
    }
    return <>{content}</>;
  };

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        {hasSelection && <Text color={colors.ui.textMuted}>{"  "}</Text>}
        {columns.map((column, colIndex) => (
          <Box key={column.key} marginRight={colIndex < columns.length - 1 ? 2 : 0}>
            <Text color={colors.ui.accent} bold>
              {column.width ? column.header.toUpperCase().padEnd(column.width) : column.header.toUpperCase()}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        {hasSelection && <Text color={colors.ui.border}>{"  "}</Text>}
        <Text color={colors.ui.border}>
          {columns.map((col, i) => {
            const width = col.width ?? col.header.length;
            const sep = "─".repeat(width);
            return i < columns.length - 1 ? sep + "──" : sep;
          }).join("")}
        </Text>
      </Box>

      {/* Data rows */}
      {data.map((row, rowIndex) => {
        const isSelected = selectedRowIndex === rowIndex;
        const rowKey = getRowKey ? getRowKey(row, rowIndex) : String(rowIndex);

        return (
          <Box key={rowKey}>
            {hasSelection && (
              <Text color={isSelected ? colors.ui.success : colors.ui.textMuted}>
                {isSelected ? "> " : "  "}
              </Text>
            )}
            {columns.map((column, colIndex) => (
              <Box key={column.key} marginRight={colIndex < columns.length - 1 ? 2 : 0}>
                <Text
                  color={isSelected ? colors.ui.text : colors.ui.textMuted}
                  bold={isSelected}
                >
                  {renderCell(row[column.key], column.width)}
                </Text>
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
