import { useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { useKey, useKeys } from '@/hooks/keyboard';
import type { TableColumn } from '@stargazer/schemas/ui';

export type { TableColumn };

// Web-specific: only uses string widths
export interface WebTableColumn extends Omit<TableColumn, "width"> {
  width?: string;
}

export interface TableProps<T extends Record<string, ReactNode>> {
    columns: WebTableColumn[];
    data: T[];
    getRowKey?: (row: T, index: number) => string;
    selectedRowIndex?: number;
    onRowSelect?: (index: number) => void;
    onRowClick?: (row: T, index: number) => void;
    className?: string;
}

export function Table<T extends Record<string, ReactNode>>({
    columns,
    data,
    getRowKey,
    selectedRowIndex,
    onRowSelect,
    onRowClick,
    className,
}: TableProps<T>) {
    const tableRef = useRef<HTMLTableElement>(null);
    const enabled = selectedRowIndex !== undefined && !!onRowSelect;

    const handleRowClick = useCallback((row: T, rowIndex: number) => {
        onRowSelect?.(rowIndex);
        onRowClick?.(row, rowIndex);
    }, [onRowSelect, onRowClick]);

    useKeys(['j', 'ArrowDown'], () => {
        if (selectedRowIndex !== undefined && onRowSelect) {
            onRowSelect(Math.min(selectedRowIndex + 1, data.length - 1));
        }
    }, { enabled });

    useKeys(['k', 'ArrowUp'], () => {
        if (selectedRowIndex !== undefined && onRowSelect) {
            onRowSelect(Math.max(selectedRowIndex - 1, 0));
        }
    }, { enabled });

    useKey('Enter', () => {
        if (selectedRowIndex !== undefined && onRowClick) {
            onRowClick(data[selectedRowIndex], selectedRowIndex);
        }
    }, { enabled: enabled && !!onRowClick });

    return (
        <div className={cn('overflow-auto border border-[--tui-border]', className)}>
            <table
                ref={tableRef}
                className="w-full text-left text-xs sm:text-sm border-collapse table-fixed font-mono"
            >
                <thead>
                    <tr className="bg-[--tui-selection] text-[--tui-violet] uppercase text-xs tracking-wider border-b border-[--tui-border]">
                        {columns.map((column, colIndex) => (
                            <th
                                key={column.key}
                                className={cn(
                                    'font-normal py-2 px-3',
                                    colIndex < columns.length - 1 && 'border-r border-[--tui-border]'
                                )}
                                style={column.width ? { width: column.width } : undefined}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[--tui-border]">
                    {data.map((row, rowIndex) => {
                        const isSelected = selectedRowIndex === rowIndex;
                        return (
                            <tr
                                // Using index as fallback is acceptable since getRowKey is the expected pattern for stable keys
                                key={getRowKey ? getRowKey(row, rowIndex) : rowIndex}
                                className={cn(
                                    'cursor-pointer transition-colors',
                                    isSelected
                                        ? 'bg-[--tui-fg] text-[--tui-bg] font-medium'
                                        : 'hover:bg-[--tui-selection]'
                                )}
                                onClick={() => handleRowClick(row, rowIndex)}
                            >
                                {columns.map((column, colIndex) => (
                                    <td
                                        key={column.key}
                                        className={cn(
                                            'py-2 px-3',
                                            colIndex < columns.length - 1 &&
                                                (isSelected
                                                    ? 'border-r border-[--tui-bg] border-opacity-20'
                                                    : 'border-r border-[--tui-border]')
                                        )}
                                    >
                                        {row[column.key]}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
