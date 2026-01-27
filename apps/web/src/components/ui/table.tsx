import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TableColumn {
    key: string;
    header: string;
    width?: string;
}

export interface TableProps<T extends Record<string, React.ReactNode>> {
    columns: TableColumn[];
    data: T[];
    selectedRowIndex?: number;
    onRowSelect?: (index: number) => void;
    onRowClick?: (row: T, index: number) => void;
    className?: string;
}

export function Table<T extends Record<string, React.ReactNode>>({
    columns,
    data,
    selectedRowIndex,
    onRowSelect,
    onRowClick,
    className,
}: TableProps<T>) {
    const tableRef = React.useRef<HTMLTableElement>(null);

    React.useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (selectedRowIndex === undefined || !onRowSelect) return;

            if (event.key === 'j' || event.key === 'ArrowDown') {
                event.preventDefault();
                const nextIndex = Math.min(selectedRowIndex + 1, data.length - 1);
                onRowSelect(nextIndex);
            } else if (event.key === 'k' || event.key === 'ArrowUp') {
                event.preventDefault();
                const prevIndex = Math.max(selectedRowIndex - 1, 0);
                onRowSelect(prevIndex);
            } else if (event.key === 'Enter' && onRowClick) {
                event.preventDefault();
                onRowClick(data[selectedRowIndex], selectedRowIndex);
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRowIndex, onRowSelect, onRowClick, data]);

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
                                key={rowIndex}
                                className={cn(
                                    'cursor-pointer transition-colors',
                                    isSelected
                                        ? 'bg-[--tui-fg] text-[--tui-bg] font-medium'
                                        : 'hover:bg-[--tui-selection]'
                                )}
                                onClick={() => {
                                    onRowSelect?.(rowIndex);
                                    onRowClick?.(row, rowIndex);
                                }}
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
