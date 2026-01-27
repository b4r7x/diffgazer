import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    disabled?: boolean;
    focused?: boolean;
    className?: string;
}

export function Checkbox({
    checked,
    onChange,
    label,
    disabled = false,
    focused = false,
    className,
}: CheckboxProps) {
    const handleClick = () => {
        if (!disabled) {
            onChange(!checked);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange(!checked);
        }
    };

    return (
        <div
            role="checkbox"
            aria-checked={checked}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={cn(
                'flex items-center gap-4 px-3 py-2 font-mono cursor-pointer select-none',
                focused
                    ? 'bg-[--tui-blue] text-black font-bold'
                    : 'text-[--tui-fg]',
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
        >
            <span className={cn(
                'font-bold',
                checked && !focused && 'text-[--tui-blue]'
            )}>
                {checked ? '[x]' : '[ ]'}
            </span>
            <span>{label}</span>
        </div>
    );
}
