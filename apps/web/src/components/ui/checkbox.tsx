import * as React from 'react';
import { cn } from '../../lib/utils';

type CheckboxSize = 'sm' | 'md' | 'lg';

const checkboxVariants = {
    base: 'flex items-center cursor-pointer select-none font-mono',
    container: 'flex items-center gap-4 px-3 py-2',
    indicator: {
        sm: 'text-sm font-bold min-w-4',
        md: 'font-bold min-w-5',
        lg: 'text-lg font-bold min-w-6',
    },
    label: {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
    },
    states: {
        focused: 'bg-[--tui-blue] text-black font-bold',
        unfocused: 'text-[--tui-fg]',
        disabled: 'opacity-50 cursor-not-allowed',
        checkedIndicator: 'text-[--tui-blue]',
    },
};

export interface CheckboxProps {
    checked?: boolean;
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    label?: React.ReactNode;
    disabled?: boolean;
    focused?: boolean;
    size?: CheckboxSize;
    className?: string;
}

export function Checkbox({
    checked: controlledChecked,
    defaultChecked = false,
    onCheckedChange,
    label,
    disabled = false,
    focused = false,
    size = 'md',
    className,
}: CheckboxProps) {
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked);
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : uncontrolledChecked;

    const handleChange = (newChecked: boolean) => {
        if (disabled) return;
        if (onCheckedChange) {
            onCheckedChange(newChecked);
        }
        if (!isControlled) {
            setUncontrolledChecked(newChecked);
        }
    };

    const handleClick = () => {
        handleChange(!checked);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleChange(!checked);
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
                checkboxVariants.base,
                checkboxVariants.container,
                focused ? checkboxVariants.states.focused : checkboxVariants.states.unfocused,
                disabled && checkboxVariants.states.disabled,
                className
            )}
        >
            <span
                className={cn(
                    checkboxVariants.indicator[size],
                    checked && !focused && checkboxVariants.states.checkedIndicator
                )}
            >
                {checked ? '[x]' : '[ ]'}
            </span>
            {label && (
                <span className={checkboxVariants.label[size]}>
                    {label}
                </span>
            )}
        </div>
    );
}

interface CheckboxGroupContextType {
    value: string[];
    onValueChange: (value: string[]) => void;
    disabled?: boolean;
    size?: CheckboxSize;
}

const CheckboxGroupContext = React.createContext<CheckboxGroupContextType | undefined>(
    undefined
);

export interface CheckboxGroupProps {
    value?: string[];
    defaultValue?: string[];
    onValueChange?: (value: string[]) => void;
    disabled?: boolean;
    size?: CheckboxSize;
    className?: string;
    children: React.ReactNode;
}

export function CheckboxGroup({
    value: controlledValue,
    defaultValue = [],
    onValueChange,
    disabled = false,
    size = 'md',
    className,
    children,
}: CheckboxGroupProps) {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleValueChange = (newValue: string[]) => {
        if (onValueChange) {
            onValueChange(newValue);
        }
        if (!isControlled) {
            setUncontrolledValue(newValue);
        }
    };

    return (
        <CheckboxGroupContext.Provider
            value={{
                value,
                onValueChange: handleValueChange,
                disabled,
                size,
            }}
        >
            <div className={cn('flex flex-col gap-2', className)}>
                {children}
            </div>
        </CheckboxGroupContext.Provider>
    );
}

export interface CheckboxItemProps {
    value: string;
    label: React.ReactNode;
    focused?: boolean;
    className?: string;
}

export function CheckboxItem({
    value,
    label,
    focused = false,
    className,
}: CheckboxItemProps) {
    const context = React.useContext(CheckboxGroupContext);
    if (!context) {
        throw new Error('CheckboxItem must be used within CheckboxGroup');
    }

    const { value: groupValue, onValueChange, disabled: groupDisabled, size } = context;
    const isChecked = groupValue.includes(value);

    const handleChange = (checked: boolean) => {
        const newValue = checked
            ? [...groupValue, value]
            : groupValue.filter((v) => v !== value);
        onValueChange(newValue);
    };

    return (
        <Checkbox
            checked={isChecked}
            onCheckedChange={handleChange}
            label={label}
            disabled={groupDisabled}
            focused={focused}
            size={size}
            className={className}
        />
    );
}

export { checkboxVariants };
