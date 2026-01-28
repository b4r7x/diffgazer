import * as React from 'react';
import { cn } from '../../lib/utils';
import { useSelectableList, useKey } from '@/hooks/keyboard';

type CheckboxSize = 'sm' | 'md' | 'lg';

const checkboxVariants = {
    base: 'flex items-center cursor-pointer select-none font-mono relative',
    container: 'flex items-center gap-3 px-3 py-2',
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
        focused: 'bg-tui-selection text-white font-bold',
        focusedAccent: 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-tui-blue',
        unfocused: 'text-tui-fg hover:bg-tui-selection/50',
        disabled: 'opacity-50 cursor-not-allowed',
        checkedIndicator: 'text-tui-green',
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
                focused && checkboxVariants.states.focusedAccent,
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

interface CheckboxItemData {
    value: string;
    disabled: boolean;
    index: number;
}

interface CheckboxGroupContextType {
    value: string[];
    onValueChange: (value: string[]) => void;
    disabled?: boolean;
    size?: CheckboxSize;
    focusedIndex: number;
    items: CheckboxItemData[];
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
    wrap?: boolean;
    onBoundaryReached?: (direction: 'up' | 'down') => void;
}

export function CheckboxGroup({
    value: controlledValue,
    defaultValue = [],
    onValueChange,
    disabled = false,
    size = 'md',
    className,
    children,
    wrap = true,
    onBoundaryReached,
}: CheckboxGroupProps) {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const items: CheckboxItemData[] = [];
    let itemIndex = 0;

    function extractItems(node: React.ReactNode) {
        React.Children.forEach(node, (child) => {
            if (!React.isValidElement(child)) return;
            if (child.type === React.Fragment) {
                extractItems((child.props as { children?: React.ReactNode }).children);
            } else if (child.type === CheckboxItem) {
                const childProps = child.props as CheckboxItemProps;
                items.push({
                    value: childProps.value,
                    disabled: childProps.disabled ?? false,
                    index: itemIndex++,
                });
            }
        });
    }

    extractItems(children);

    const getDisabled = (index: number) => items[index]?.disabled ?? false;

    const { focusedIndex } = useSelectableList({
        itemCount: items.length,
        getDisabled,
        wrap,
        onBoundaryReached,
        enabled: !disabled && items.length > 0,
    });

    const handleValueChange = (newValue: string[]) => {
        if (onValueChange) {
            onValueChange(newValue);
        }
        if (!isControlled) {
            setUncontrolledValue(newValue);
        }
    };

    const handleToggle = () => {
        const item = items[focusedIndex];
        if (!item || item.disabled || disabled) return;

        const newValue = value.includes(item.value)
            ? value.filter((v) => v !== item.value)
            : [...value, item.value];
        handleValueChange(newValue);
    };

    useKey('Enter', handleToggle, { enabled: !disabled && items.length > 0 });
    useKey(' ', handleToggle, { enabled: !disabled && items.length > 0 });

    return (
        <CheckboxGroupContext.Provider
            value={{
                value,
                onValueChange: handleValueChange,
                disabled,
                size,
                focusedIndex,
                items,
            }}
        >
            <div role="group" className={cn('flex flex-col gap-2', className)}>
                {children}
            </div>
        </CheckboxGroupContext.Provider>
    );
}

export interface CheckboxItemProps {
    value: string;
    label: React.ReactNode;
    description?: React.ReactNode;
    disabled?: boolean;
    className?: string;
}

export function CheckboxItem({
    value,
    label,
    description,
    disabled = false,
    className,
}: CheckboxItemProps) {
    const context = React.useContext(CheckboxGroupContext);
    if (!context) {
        throw new Error('CheckboxItem must be used within CheckboxGroup');
    }

    const { value: groupValue, onValueChange, disabled: groupDisabled, size, focusedIndex, items } = context;
    const isChecked = groupValue.includes(value);
    const itemData = items.find((item) => item.value === value);
    const isFocused = itemData ? itemData.index === focusedIndex : false;
    const isDisabled = disabled || groupDisabled;

    const handleChange = (checked: boolean) => {
        if (isDisabled) return;
        const newValue = checked
            ? [...groupValue, value]
            : groupValue.filter((v) => v !== value);
        onValueChange(newValue);
    };

    if (description) {
        return (
            <div
                role="checkbox"
                aria-checked={isChecked}
                aria-disabled={isDisabled}
                onClick={() => handleChange(!isChecked)}
                className={cn(
                    checkboxVariants.base,
                    checkboxVariants.container,
                    'items-start',
                    isFocused ? checkboxVariants.states.focused : checkboxVariants.states.unfocused,
                    isFocused && checkboxVariants.states.focusedAccent,
                    isDisabled && checkboxVariants.states.disabled,
                    className
                )}
            >
                <span
                    className={cn(
                        checkboxVariants.indicator[size ?? 'md'],
                        isChecked && !isFocused && checkboxVariants.states.checkedIndicator
                    )}
                >
                    {isChecked ? '[x]' : '[ ]'}
                </span>
                <div className="flex flex-col min-w-0">
                    <span className={checkboxVariants.label[size ?? 'md']}>{label}</span>
                    <span className={cn('text-sm mt-0.5', isFocused ? 'text-white/70' : 'text-tui-muted')}>
                        {description}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <Checkbox
            checked={isChecked}
            onCheckedChange={handleChange}
            label={label}
            disabled={isDisabled}
            focused={isFocused}
            size={size}
            className={className}
        />
    );
}

export { checkboxVariants };
