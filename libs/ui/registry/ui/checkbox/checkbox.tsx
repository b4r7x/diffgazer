"use client";

import {
  type AriaAttributes,
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  useId,
  useRef,
  useState,
} from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { mergeIds, resolveAriaInvalid } from "@/lib/aria";
import { composeRefs } from "@/lib/compose-refs";
import {
  type SelectableSize,
  type SelectableVariant,
  selectableContainerClass,
  selectableDescriptionVariants,
  selectableIndicators,
  selectableIndicatorVariants,
  selectableLabelVariants,
  selectableVariants,
} from "@/lib/selectable-variants";
import { cn } from "@/lib/utils";

type CheckboxState = "indeterminate" | "checked" | "unchecked";

function resolveCheckboxState(indeterminate: boolean, checked: boolean): CheckboxState {
  if (indeterminate) return "indeterminate";
  if (checked) return "checked";
  return "unchecked";
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
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
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
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
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
  const resolvedAriaInvalid = resolveAriaInvalid(ariaInvalid, nativeInvalid && required && !isChecked);
  const resolvedAriaLabelledBy = ariaLabel
    ? undefined
    : mergeIds(ariaLabelledBy, label ? labelId : undefined);
  const resolvedAriaDescribedBy = mergeIds(
    ariaDescribedBy,
    description ? descriptionId : undefined,
  );

  useFormReset(rootRef, defaultChecked, setIsChecked, controlledBool === undefined);

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
        // Validation/submission-only mirror: aria-hidden keeps it out of the
        // a11y tree, so naming/invalid/described-by live on the visible control.
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
          onInvalid={(event) => {
            event.preventDefault();
            setNativeInvalid(true);
            rootRef.current?.focus();
          }}
        />
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: this is the custom-styled checkbox control; a hidden native <input type="checkbox"> (rendered separately) owns form submission, so the visible control uses role="checkbox". */}
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
        aria-labelledby={resolvedAriaLabelledBy}
        aria-describedby={resolvedAriaDescribedBy}
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
