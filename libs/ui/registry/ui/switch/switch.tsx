"use client";

import { cva } from "class-variance-authority";
import { type AriaAttributes, type ComponentPropsWithRef, type Ref, useRef, useState } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { resolveAriaInvalid } from "@/lib/aria";
import { useFieldsetDisabled } from "@/lib/fieldset-disabled";
import { cn } from "@/lib/utils";

/** Allowed switch size values. */
export type SwitchSize = "sm" | "md";

/** Props for switch root. */
type SwitchRootProps = Omit<
  ComponentPropsWithRef<"button">,
  | "children"
  | "role"
  | "type"
  | "aria-checked"
  | "aria-disabled"
  | "aria-required"
  | "aria-invalid"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "onChange"
  | "className"
  | "ref"
>;

/** Props for switch. */
export type SwitchProps = SwitchRootProps & {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  size?: SwitchSize;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  className?: string;
  ref?: Ref<HTMLButtonElement>;
};

const trackVariants = cva(
  [
    "relative inline-flex items-center shrink-0",
    "font-mono cursor-pointer select-none",
    "border border-border rounded-sm",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  ],
  {
    variants: {
      size: {
        // sm keeps a 20px visual track but extends a transparent ≥24px pointer
        // hit area (WCAG 2.5.8 AA) via a pseudo-element with negative vertical inset.
        sm: "h-5 w-9 text-xs before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']",
        md: "h-6 w-11 text-sm",
      },
      checked: {
        true: "bg-primary border-primary",
        false: "bg-muted",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      checked: false,
      disabled: false,
    },
  },
);

const thumbVariants = cva(
  [
    "block rounded-sm bg-background border border-border",
    "transition-transform duration-150",
    "font-mono leading-none flex items-center justify-center",
  ],
  {
    variants: {
      size: {
        sm: "h-3.5 w-3.5 text-2xs",
        md: "h-4 w-4 text-xs",
      },
      checked: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { size: "sm", checked: false, className: "translate-x-0.5" },
      { size: "sm", checked: true, className: "translate-x-[1.125rem]" },
      { size: "md", checked: false, className: "translate-x-0.5" },
      { size: "md", checked: true, className: "translate-x-[1.375rem]" },
    ],
    defaultVariants: {
      size: "md",
      checked: false,
    },
  },
);

/** Binary toggle (controlled or uncontrolled) */
export function Switch({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  onClick,
  disabled = false,
  required,
  name,
  value = "on",
  size = "md",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  form,
  className,
  ref,
  ...rootProps
}: SwitchProps) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const [isChecked, setIsChecked, , resetChecked] = useControllableState<boolean>({
    value: controlledChecked,
    defaultValue: defaultChecked,
    onChange,
  });
  const fieldsetDisabled = useFieldsetDisabled(rootRef);
  const isDisabled = disabled || fieldsetDisabled;
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const resolvedAriaInvalid = resolveAriaInvalid(
    ariaInvalid,
    nativeInvalid && required && !isChecked,
  );
  const controlledFormReset =
    controlledChecked === undefined
      ? undefined
      : {
          syncResetBaseline: () => {
            if (nativeInputRef.current) nativeInputRef.current.defaultChecked = isChecked;
          },
          onReset: () => setNativeInvalid(false),
        };

  const invalidatePendingReset = useFormReset(
    rootRef,
    defaultChecked,
    (value) => {
      setNativeInvalid(false);
      resetChecked(value);
    },
    controlledChecked === undefined,
    controlledFormReset,
  );

  const toggle = () => {
    if (isDisabled) return;
    invalidatePendingReset();
    setNativeInvalid(false);
    setIsChecked(!isChecked);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (!event.defaultPrevented) toggle();
  };

  return (
    <>
      {(name || required) && (
        <input
          ref={nativeInputRef}
          type="checkbox"
          data-slot="switch-form-mirror"
          name={name}
          form={form}
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
      <button
        {...rootProps}
        ref={composedRef}
        type="button"
        form={form}
        role="switch"
        data-slot="switch"
        data-state={isChecked ? "checked" : "unchecked"}
        data-disabled={isDisabled ? "" : undefined}
        aria-checked={isChecked}
        aria-disabled={isDisabled || undefined}
        aria-required={required || undefined}
        aria-invalid={resolvedAriaInvalid}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={isDisabled}
        onClick={handleClick}
        className={cn(trackVariants({ size, checked: isChecked, disabled: isDisabled }), className)}
      >
        <span
          aria-hidden="true"
          data-slot="switch-thumb"
          className={thumbVariants({ size, checked: isChecked })}
        />
      </button>
    </>
  );
}
