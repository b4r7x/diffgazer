"use client";

import { cva } from "class-variance-authority";
import {
  type AriaAttributes,
  type ComponentPropsWithRef,
  type MouseEvent,
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
import { useFieldsetDisabled } from "@/lib/fieldset-disabled";
import { FOCUS_OUTLINE } from "@/lib/focus-outline";
import {
  selectableContainerClass,
  selectableDescriptionVariants,
  selectableLabelVariants,
} from "@/lib/selectable-variants";
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
  /** Visible label rendered beside the track, wired as the accessible name. */
  label?: ReactNode;
  /** Visible description rendered under the label, wired with aria-describedby. */
  description?: ReactNode;
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
    "transition-colors duration-150 motion-reduce:transition-none",
    FOCUS_OUTLINE,
    "aria-invalid:border-error aria-invalid:ring-1 aria-invalid:ring-error aria-invalid:focus:ring-error",
  ],
  {
    variants: {
      size: {
        // Both sizes keep their visual track and extend a transparent pointer hit
        // area via a pseudo-element with negative insets, reaching 44x44px on
        // pointer:coarse (WCAG 2.5.5). sm also carries a 2px fine-pointer extension
        // because its 20px track would otherwise miss the 24px floor of WCAG 2.5.8;
        // md is 24x44 on its own and gets no fine-pointer pseudo at all.
        sm: "h-5 w-9 text-xs before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-[''] pointer-coarse:before:-inset-y-3 pointer-coarse:before:-inset-x-1",
        md: "h-6 w-11 text-sm pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-2.5 pointer-coarse:before:content-['']",
      },
      checked: {
        true: "bg-primary border-primary",
        // Recessed surface token, not the muted text token: keeps the off track
        // hue-free and clearly emptier than the filled on track.
        false: "bg-secondary",
      },
      // Dashed edge, not a fade: the same disabled grammar Input/Textarea already use, and the
      // one that survives forced-colors mode (which drops opacity but keeps border-style).
      disabled: {
        true: "border-dashed cursor-not-allowed",
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
    "rounded-sm bg-background text-foreground border border-border",
    "transition-transform duration-150 motion-reduce:transition-none",
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
      // The 0/1 digit and the thumb fill carry the disabled tone the track no longer fades in.
      disabled: {
        true: "bg-secondary text-muted-foreground forced-colors:text-[GrayText]",
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
      disabled: false,
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
  label,
  description,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  form,
  className,
  ref,
  ...rootProps
}: SwitchProps) {
  const hasRow = label !== undefined || description !== undefined;
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const descriptionId = `${generatedId}-desc`;
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
  // Same naming precedence as Checkbox: an explicit aria-label wins, otherwise the rendered
  // label joins whatever aria-labelledby the consumer passed.
  const resolvedAriaLabelledBy = ariaLabel
    ? undefined
    : mergeIds(ariaLabelledBy, label ? labelId : undefined);
  const resolvedAriaDescribedBy = mergeIds(
    ariaDescribedBy,
    description ? descriptionId : undefined,
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

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (!event.defaultPrevented) toggle();
  };

  const handleLabelClick = () => {
    if (isDisabled) return;
    rootRef.current?.focus();
    rootRef.current?.click();
  };

  const control = (
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
      aria-labelledby={resolvedAriaLabelledBy}
      aria-describedby={resolvedAriaDescribedBy}
      disabled={isDisabled}
      onClick={handleClick}
      className={cn(trackVariants({ size, checked: isChecked, disabled: isDisabled }), className)}
    >
      <span
        aria-hidden="true"
        data-slot="switch-thumb"
        className={thumbVariants({ size, checked: isChecked, disabled: isDisabled })}
      >
        {/* Binary glyph so on/off stays readable in a still frame, without
            relying on track inversion or thumb position alone. */}
        {isChecked ? "1" : "0"}
      </span>
    </button>
  );

  // Without a label the render is byte-identical to the pre-label markup, so existing call sites
  // that hand-roll their own row are untouched.
  const row = hasRow ? (
    <div
      data-slot="switch-row"
      className={cn(selectableContainerClass, description && "items-start")}
    >
      {control}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: this forwards clicks to the switch button, which owns keyboard activation. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: same — the button beside it is the interactive element. */}
      <div
        className={cn("flex flex-col min-w-0", !description && "justify-center")}
        onClick={handleLabelClick}
      >
        {label && (
          <span id={labelId} className={selectableLabelVariants({ size })}>
            {label}
          </span>
        )}
        {description && (
          <span
            id={descriptionId}
            className={selectableDescriptionVariants({ disabled: isDisabled })}
          >
            {description}
          </span>
        )}
      </div>
    </div>
  ) : (
    control
  );

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
      {row}
    </>
  );
}
