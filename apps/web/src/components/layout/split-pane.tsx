import * as React from 'react';
import { cn } from '../../lib/utils';

interface SplitPaneProps extends React.HTMLAttributes<HTMLDivElement> {
    left: React.ReactNode;
    right: React.ReactNode;
    leftWidth?: number; // Percentage, e.g., 40
    onLeftWidthChange?: (width: number) => void;
}

export function SplitPane({
    left,
    right,
    leftWidth = 40,
    onLeftWidthChange,
    className,
    ...props
}: SplitPaneProps) {
    // Simplified implementation without drag resizing for now, as verified in requirements
    // just the layout structure.

    return (
        <div className={cn('flex h-full w-full overflow-hidden', className)} {...props}>
            <div
                className="h-full overflow-hidden border-r border-border"
                style={{ width: `${leftWidth}%` }}
            >
                {left}
            </div>
            <div
                className="h-full flex-1 overflow-hidden"
            >
                {right}
            </div>
        </div>
    );
}
