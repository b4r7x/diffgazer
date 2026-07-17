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
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { mergeIds, resolveAriaInvalid } from "@/lib/aria";
import { useFieldsetDisabled } from "@/lib/selectable-collection";
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

/** Allowed checkbox state values. */
type CheckboxState = "indeterminate" | "checked" | "unchecked";

function resolveCheckboxState(indeterminate: boolean, checked: boolean): CheckboxState {
  if (indeterminate) return "indeterminate";
  if (checked) return "checked";
  return "unchecked";
}

/** Allowed checkbox size values. */
export type CheckboxSize = SelectableSize;

/** Allowed checkbox variant values. */
export type CheckboxVariant = SelectableVariant;

/** Props for checkbox root. */
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

/** Props for checkbox. */
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

/** Standalone checkbox (controlled or uncontrolled) */
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
  const controlledBool = controlledChecked === undefined ? undefined : controlledChecked === true;

  const rootRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const [isChecked, setIsChecked, , resetChecked] = useControllableState<boolean>({
    value: controlledBool,
    defaultValue: defaultChecked,
    onChange,
  });
  const fieldsetDisabled = useFieldsetDisabled(rootRef);
  const isDisabled = disabled || fieldsetDisabled;
  const state = resolveCheckboxState(isIndeterminate, isChecked);
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const resolvedAriaInvalid = resolveAriaInvalid(
    ariaInvalid,
    nativeInvalid && required && !isChecked,
  );
  const resolvedAriaLabelledBy = ariaLabel
    ? undefined
    : mergeIds(ariaLabelledBy, label ? labelId : undefined);
  const resolvedAriaDescribedBy = mergeIds(
    ariaDescribedBy,
    description ? descriptionId : undefined,
  );
  const controlledFormReset =
    controlledBool === undefined
      ? undefined
      : {
          syncResetBaseline: () => {
            if (rootRef.current?.hasAttribute("data-diffgazer-checkbox-group-item")) return;
            if (nativeInputRef.current) nativeInputRef.current.defaultChecked = isChecked;
          },
          onReset: () => {
            if (rootRef.current?.hasAttribute("data-diffgazer-checkbox-group-item")) return;
            setNativeInvalid(false);
          },
        };

  const invalidatePendingReset = useFormReset(
    rootRef,
    defaultChecked,
    (value) => {
      setNativeInvalid(false);
      resetChecked(value);
    },
    controlledBool === undefined,
    controlledFormReset,
  );

  const toggle = () => {
    if (isDisabled) return;
    invalidatePendingReset();
    setNativeInvalid(false);
    setIsChecked(!isChecked);
  };

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (!event.defaultPrevented) toggle();
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  const indicator = selectableIndicators[variant][state];
  let dataState = "unchecked";
  if (isIndeterminate) {
    dataState = "indeterminate";
  } else if (isChecked) {
    dataState = "checked";
  }

  return (
    <>
      {(name || required) && (
        // Validation/submission-only mirror: aria-hidden keeps it out of the
        // a11y tree, so naming/invalid/described-by live on the visible control.
        <input
          ref={nativeInputRef}
          type="checkbox"
          data-slot="checkbox-form-mirror"
          name={name}
          value={value}
          checked={isChecked}
          required={required}
          disabled={isDisabled}
          className="sr-only"
          tabIndex={-1}
          aria-hidden={true}
          onChange={() => {}}
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
        ref={composedRef}
        role="checkbox"
        data-slot="checkbox"
        data-value={dataValue ?? value}
        data-state={dataState}
        data-disabled={isDisabled ? "" : undefined}
        data-highlighted={highlighted ? "" : undefined}
        aria-checked={isIndeterminate ? "mixed" : isChecked}
        aria-disabled={isDisabled || undefined}
        aria-required={required || undefined}
        aria-invalid={resolvedAriaInvalid}
        aria-label={ariaLabel}
        aria-labelledby={resolvedAriaLabelledBy}
        aria-describedby={resolvedAriaDescribedBy}
        tabIndex={isDisabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={onMouseEnter}
        className={cn(
          selectableVariants({ highlighted, disabled: isDisabled }),
          selectableContainerClass,
          description && "items-start",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={selectableIndicatorVariants({ size, checked: isChecked, highlighted })}
        >
          {indicator}
        </span>
        {label && (
          <div className={cn("flex flex-col min-w-0", !description && "justify-center")}>
            <span
              id={labelId}
              className={cn(
                selectableLabelVariants({ size }),
                strikethrough && isChecked && "text-muted-foreground line-through",
              )}
            >
              {label}
            </span>
            {description && (
              <span id={descriptionId} className={selectableDescriptionVariants({ highlighted })}>
                {description}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
