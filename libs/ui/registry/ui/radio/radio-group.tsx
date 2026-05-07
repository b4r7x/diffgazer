"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import type { RadioSize } from "./radio";
import type { SelectableVariant } from "@/lib/selectable-variants";
import { RadioGroupContext, type RadioGroupContextValue } from "./radio-group-context";

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** @deprecated Use `onValueChange` for controlled value updates. */
  onChange?: (value: string) => void;
  onHighlightChange?: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  highlighted?: string | null;
  orientation?: "vertical" | "horizontal";
  wrap?: boolean;
  disabled?: boolean;
  size?: RadioSize;
  variant?: SelectableVariant;
  name?: string;
  required?: boolean;
  label?: string;
  labelledBy?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

interface RadioGroupItemElementProps {
  value?: string;
  disabled?: boolean;
  children?: ReactNode;
}

function collectInitialItems(children: ReactNode): Array<{ value: string; disabled: boolean }> {
  const items: Array<{ value: string; disabled: boolean }> = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<RadioGroupItemElementProps>(child)) return;
    if (typeof child.props.value === "string") {
      items.push({ value: child.props.value, disabled: !!child.props.disabled });
      return;
    }
    items.push(...collectInitialItems(child.props.children));
  });

  return items;
}

export function RadioGroup(props: RadioGroupProps) {
  const {
    value: controlledValue,
    defaultValue,
    onValueChange,
    onChange,
    onHighlightChange,
    onKeyDown,
    highlighted: controlledHighlighted,
    orientation = "vertical",
    wrap = true,
    disabled = false,
    size = "md",
    variant = "bullet",
    name,
    required,
    label,
    labelledBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    className,
    children,
    ref,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => collectInitialItems(children), [children]);
  const [requiredInvalid, setRequiredInvalid] = useState(false);

  const [value, setValue] = useControllableState<string | undefined>({
    value: controlledValue,
    controlled: "value" in props,
    defaultValue,
    onChange: (onValueChange ?? onChange) as ((value: string | undefined) => void) | undefined,
  });
  useFormReset(containerRef, defaultValue, setValue, !("value" in props));
  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    controlled: "highlighted" in props,
    defaultValue: null,
    onChange: onHighlightChange as ((value: string | null) => void) | undefined,
  });

  const firstEnabledValue = items.find((item) => !item.disabled)?.value ?? null;

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "radio",
    orientation,
    wrap,
    moveFocus: true,
    upKeys: ["ArrowUp", "ArrowLeft"],
    downKeys: ["ArrowDown", "ArrowRight"],
    value: highlightedValue,
    enabled: !disabled,
    onValueChange: (next) => {
      setHighlightedValue(next);
      setRequiredInvalid(false);
      setValue(next);
    },
  });

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    onKeyDown?.(e);
    if (!e.defaultPrevented) navKeyDown(e);
  };

  const handleValueChange = (next: string) => {
    setRequiredInvalid(false);
    setValue(next);
  };

  const handleRequiredInvalid = useCallback(() => {
    setRequiredInvalid(true);
  }, []);

  const contextValue: RadioGroupContextValue = useMemo(() => ({
    value,
    onChange: handleValueChange,
    onHighlightChange: setHighlightedValue,
    disabled,
    size,
    variant,
    highlightedValue,
    name,
    required,
    requiredInvalid,
    onRequiredInvalid: handleRequiredInvalid,
    containerRef,
    firstEnabledValue,
  }), [value, handleValueChange, setHighlightedValue, disabled, size, variant, highlightedValue, name, required, requiredInvalid, handleRequiredInvalid, firstEnabledValue]);

  return (
    <RadioGroupContext value={contextValue}>
      {required && !name && (
        <input
          type="checkbox"
          required
          checked={value !== undefined}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden={true}
          aria-label={ariaLabel ?? label}
          readOnly
          className="sr-only"
          onInvalid={(event) => {
            event.preventDefault();
            handleRequiredInvalid();
            containerRef.current?.querySelector<HTMLElement>('[role="radio"]:not([aria-disabled="true"])')?.focus();
          }}
        />
      )}
      <div
        ref={composeRefs(containerRef, ref)}
        role="radiogroup"
        aria-label={ariaLabel ?? label}
        aria-labelledby={ariaLabelledBy ?? labelledBy}
        aria-orientation={orientation}
        aria-required={required || undefined}
        aria-invalid={requiredInvalid && value === undefined ? true : undefined}
        aria-disabled={disabled || undefined}
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col gap-2" : "flex-row gap-4",
          className
        )}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </RadioGroupContext>
  );
}
