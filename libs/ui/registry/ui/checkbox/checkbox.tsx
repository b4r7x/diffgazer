"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type AriaAttributes,
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { composeRefs } from "@/lib/compose-refs";
import {
  selectableVariants,
  selectableContainerClass,
  selectableIndicatorVariants,
  selectableLabelVariants,
  selectableDescriptionVariants,
  selectableIndicators,
  type SelectableSize,
  type SelectableVariant,
} from "@/lib/selectable-variants";
import { cn } from "@/lib/utils";

type CheckboxState = "indeterminate" | "checked" | "unchecked";

function resolveCheckboxState(indeterminate: boolean, checked: boolean): CheckboxState {
  if (indeterminate) return "indeterminate";
  if (checked) return "checked";
  return "unchecked";
}

function resolveAriaInvalid(
  invalid: boolean | undefined,
  ariaInvalid: AriaAttributes["aria-invalid"],
) {
  if (invalid) return true;
  if (ariaInvalid === true || ariaInvalid === "true" || ariaInvalid === "grammar" || ariaInvalid === "spelling") {
    return ariaInvalid;
  }
  if (ariaInvalid === false || ariaInvalid === "false") return ariaInvalid;
  return undefined;
}

export type CheckboxSize = SelectableSize;

export type CheckboxVariant = SelectableVariant;

type CheckboxRootProps = Omit<
  ComponentPropsWithRef<"div">,
  | "children"
  | "role"
  | "aria-checked"
  | "aria-disabled"
  | "aria-required"
  | "aria-invalid"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "tabIndex"
  | "onChange"
  | "className"
  | "ref"
  | "data-value"
>;

export type CheckboxProps = CheckboxRootProps & {
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  highlighted?: boolean;
  size?: CheckboxSize;
  variant?: CheckboxVariant;
  strikethrough?: boolean;
  value?: string;
  name?: string;
  required?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  className?: string;
  "data-value"?: string;
  ref?: Ref<HTMLDivElement>;
};

export function Checkbox({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  onClick,
  onKeyDown,
  onMouseEnter,
  label,
  description,
  disabled = false,
  highlighted = false,
  size = "md",
  variant = "x",
  strikethrough = false,
  value = "on",
  name,
  required,
  invalid,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  className,
  "data-value": dataValue,
  ref,
  ...rootProps
}: CheckboxProps) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const descriptionId = `${generatedId}-desc`;
  const isIndeterminate = controlledChecked === "indeterminate";
  const controlledBool = controlledChecked === undefined
    ? undefined
    : controlledChecked === true;

  const rootRef = useRef<HTMLDivElement>(null);
  const [isChecked, setIsChecked] = useControllableState<boolean>({
    value: controlledBool,
    defaultValue: defaultChecked,
    onChange,
  });
  const state = resolveCheckboxState(isIndeterminate, isChecked);
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const resolvedAriaInvalid = resolveAriaInvalid(invalid || (nativeInvalid && required && !isChecked), ariaInvalid);

  useFormReset(rootRef, defaultChecked, setIsChecked, controlledBool === undefined);

  useEffect(() => {
    if (isChecked) setNativeInvalid(false);
  }, [isChecked]);

  const toggle = () => {
    if (disabled) return;
    setNativeInvalid(false);
    setIsChecked(!isChecked);
  };

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (!event.defaultPrevented) toggle();
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  const indicator = selectableIndicators[variant][state];

  return (
    <>
      {(name || required) && (
        <input
          type="checkbox"
          name={name}
          value={value}
          checked={isChecked}
          required={required}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          readOnly
          aria-hidden={true}
          aria-label={ariaLabel ?? (typeof label === "string" ? label : name)}
          onInvalid={(event) => {
            event.preventDefault();
            setNativeInvalid(true);
            rootRef.current?.focus();
          }}
        />
      )}
      <div
        {...rootProps}
        ref={composeRefs(rootRef, ref)}
        role="checkbox"
        data-value={dataValue ?? value}
        data-highlighted={highlighted ? "true" : undefined}
        aria-checked={isIndeterminate ? "mixed" : isChecked}
        aria-disabled={disabled || undefined}
        aria-required={required || undefined}
        aria-invalid={resolvedAriaInvalid}
        aria-label={ariaLabel}
        aria-labelledby={!ariaLabel && label ? labelId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={onMouseEnter}
        className={cn(
          selectableVariants({ highlighted, disabled }),
          selectableContainerClass,
          description && "items-start",
          className,
        )}
      >
        <span aria-hidden="true" className={selectableIndicatorVariants({ size, checked: isChecked, highlighted })}>
          {indicator}
        </span>
        {label && (
          <div className={cn("flex flex-col min-w-0", !description && "justify-center")}>
            <span id={labelId} className={cn(selectableLabelVariants({ size }), strikethrough && isChecked && "text-muted-foreground line-through")}>{label}</span>
            {description && (
              <span id={descriptionId} className={selectableDescriptionVariants({ highlighted })}>{description}</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
