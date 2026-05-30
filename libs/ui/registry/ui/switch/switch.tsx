"use client";

import {
  useRef,
  useState,
  type AriaAttributes,
  type ComponentPropsWithRef,
  type Ref,
} from "react";
import { cva } from "class-variance-authority";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { resolveAriaInvalid } from "@/lib/aria-utils";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";

export type SwitchSize = "sm" | "md";

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
        sm: "h-5 w-9 text-xs",
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
        sm: "h-3.5 w-3.5 text-[10px]",
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
  className,
  ref,
  ...rootProps
}: SwitchProps) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const [isChecked, setIsChecked] = useControllableState<boolean>({
    value: controlledChecked,
    defaultValue: defaultChecked,
    onChange,
  });
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const resolvedAriaInvalid = resolveAriaInvalid(ariaInvalid, nativeInvalid && required && !isChecked);

  useFormReset(rootRef, defaultChecked, setIsChecked, controlledChecked === undefined);

  const toggle = () => {
    if (disabled) return;
    setNativeInvalid(false);
    setIsChecked(!isChecked);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
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
          aria-label={ariaLabel ?? name}
          onInvalid={(event) => {
            event.preventDefault();
            setNativeInvalid(true);
            rootRef.current?.focus();
          }}
        />
      )}
      <button
        {...rootProps}
        ref={composeRefs(rootRef, ref)}
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-disabled={disabled || undefined}
        aria-required={required || undefined}
        aria-invalid={resolvedAriaInvalid}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={handleClick}
        className={cn(trackVariants({ size, checked: isChecked, disabled }), className)}
      >
        <span
          aria-hidden="true"
          className={thumbVariants({ size, checked: isChecked })}
        />
      </button>
    </>
  );
}
