"use client";

import { Children, isValidElement, useCallback, useMemo, useRef, type ReactNode, type Ref, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { ToggleGroupContext } from "./toggle-group-context";

export interface ToggleGroupProps {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** @deprecated Use `onValueChange` for controlled value updates. */
  onChange?: (value: string | null) => void;
  allowDeselect?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  orientation?: "horizontal" | "vertical";
  wrap?: boolean;
  highlighted?: string | null;
  onHighlightChange?: (value: string | null) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  label?: string;
  "aria-labelledby"?: string;
  name?: string;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

interface ToggleGroupItemElementProps {
  value?: string;
  disabled?: boolean;
  children?: ReactNode;
}

function collectToggleItems(children: ReactNode): Array<{ value: string; disabled: boolean }> {
  const items: Array<{ value: string; disabled: boolean }> = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<ToggleGroupItemElementProps>(child)) return;
    if (typeof child.props.value === "string") {
      items.push({ value: child.props.value, disabled: !!child.props.disabled });
      return;
    }
    items.push(...collectToggleItems(child.props.children));
  });

  return items;
}

function getEnabledItemValue(
  items: Array<{ value: string; disabled: boolean }>,
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  return items.some((item) => item.value === value && !item.disabled) ? value : null;
}

export function ToggleGroup({
  value: controlledValue,
  defaultValue,
  onValueChange,
  onChange,
  allowDeselect = false,
  disabled = false,
  size = "sm",
  orientation = "horizontal",
  wrap = true,
  highlighted: controlledHighlighted,
  onHighlightChange,
  onKeyDown,
  label,
  "aria-labelledby": ariaLabelledBy,
  name,
  className,
  children,
  ref,
}: ToggleGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => collectToggleItems(children), [children]);

  const [value, setValue, isControlled] = useControllableState<string | null>({
    value: controlledValue,
    defaultValue: defaultValue ?? null,
    onChange: onValueChange ?? onChange,
  });
  useFormReset(containerRef, defaultValue ?? null, setValue, !isControlled);

  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    defaultValue: null,
    onChange: onHighlightChange,
  });

  const handleValueChange = useCallback((newValue: string) => {
    setValue((prev) => (prev === newValue && allowDeselect) ? null : newValue);
  }, [allowDeselect, setValue]);

  const enabledItems = disabled ? [] : items;
  const validHighlightedValue = getEnabledItemValue(enabledItems, highlightedValue);
  const validSelectedValue = getEnabledItemValue(enabledItems, value);
  const tabTargetValue =
    validHighlightedValue ?? validSelectedValue ?? enabledItems.find((item) => !item.disabled)?.value ?? null;

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: allowDeselect ? "button" : "radio",
    orientation,
    wrap,
    moveFocus: true,
    upKeys: ["ArrowUp", "ArrowLeft"],
    downKeys: ["ArrowDown", "ArrowRight"],
    value: tabTargetValue,
    enabled: !disabled,
    onValueChange: allowDeselect ? setHighlightedValue : handleValueChange,
  });

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    navKeyDown(e);
  };

  const contextValue = useMemo(() => ({
    value,
    onValueChange: handleValueChange,
    onHighlightChange: setHighlightedValue,
    disabled,
    size,
    highlightedValue: validHighlightedValue,
    containerRef,
    allowDeselect,
    tabTargetValue,
  }), [value, handleValueChange, setHighlightedValue, disabled, size, validHighlightedValue, allowDeselect, tabTargetValue]);

  return (
    <ToggleGroupContext value={contextValue}>
      <div
        ref={composeRefs(containerRef, ref)}
        role={allowDeselect ? "group" : "radiogroup"}
        aria-label={label}
        aria-labelledby={ariaLabelledBy}
        aria-orientation={allowDeselect ? undefined : orientation}
        aria-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col gap-1.5" : "gap-1.5",
          wrap && orientation === "horizontal" && "flex-wrap",
          className,
        )}
      >
        {name && value != null && (
          <input type="hidden" name={name} value={value} disabled={disabled} />
        )}
        {children}
      </div>
    </ToggleGroupContext>
  );
}
