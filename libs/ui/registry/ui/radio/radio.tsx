"use client";

import { useCallback, useEffect, useId, useRef, useState, type AriaAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from "react";
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

export type RadioSize = SelectableSize;

const RADIO_CHECK_EVENT = "diffgazer:radio-check";

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

interface RadioCheckEventDetail {
  name: string;
  form: HTMLFormElement | null;
  source: HTMLElement;
}

function dispatchRadioCheck(source: HTMLElement, name: string) {
  source.ownerDocument.dispatchEvent(new CustomEvent<RadioCheckEventDetail>(RADIO_CHECK_EVENT, {
    detail: {
      name,
      form: source.closest("form"),
      source,
    },
  }));
}

export interface RadioProps {
  checked?: boolean;
  defaultChecked?: boolean;
  isTabTarget?: boolean;
  onChange?: (checked: boolean) => void;
  onMouseEnter?: () => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  highlighted?: boolean;
  size?: RadioSize;
  name?: string;
  value?: string;
  required?: boolean;
  invalid?: boolean;
  variant?: SelectableVariant;
  "aria-label"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  onNativeInvalid?: () => void;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  "data-value"?: string;
}

export function Radio({
  checked,
  defaultChecked = false,
  isTabTarget = true,
  onChange,
  onMouseEnter,
  label,
  description,
  disabled = false,
  highlighted = false,
  size = "md",
  variant = "bullet",
  name,
  value = "on",
  required,
  invalid,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  onNativeInvalid,
  className,
  ref,
  "data-value": dataValue,
}: RadioProps) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const descriptionId = `${generatedId}-desc`;

  const rootRef = useRef<HTMLDivElement>(null);
  const [isChecked, setIsChecked, isControlled] = useControllableState<boolean>({
    value: checked,
    defaultValue: defaultChecked,
    onChange,
  });
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const resolvedAriaInvalid = resolveAriaInvalid(invalid || (nativeInvalid && required && !isChecked), ariaInvalid);

  useFormReset(rootRef, defaultChecked, setIsChecked, checked === undefined);

  const notifySameNameRadios = useCallback(() => {
    if (!name || isControlled || !rootRef.current) return;
    dispatchRadioCheck(rootRef.current, name);
  }, [isControlled, name]);

  useEffect(() => {
    if (!name || isControlled) return;

    const ownerDocument = rootRef.current?.ownerDocument;
    if (!ownerDocument) return;

    const handleRadioCheck = (event: Event) => {
      const { detail } = event as CustomEvent<RadioCheckEventDetail>;
      if (
        detail.name !== name ||
        detail.source === rootRef.current ||
        detail.form !== (rootRef.current?.closest("form") ?? null)
      ) {
        return;
      }

      setIsChecked(false);
    };

    ownerDocument.addEventListener(RADIO_CHECK_EVENT, handleRadioCheck);
    return () => ownerDocument.removeEventListener(RADIO_CHECK_EVENT, handleRadioCheck);
  }, [isControlled, name, setIsChecked]);

  useEffect(() => {
    if (isChecked) notifySameNameRadios();
  }, [isChecked, notifySameNameRadios]);

  const toggle = () => {
    if (disabled) return;
    setNativeInvalid(false);
    setIsChecked(true);
    notifySameNameRadios();
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;
    if (e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <>
      {(name || required) && (
        <input
          type="radio"
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
            onNativeInvalid?.();
            if (!onNativeInvalid) setNativeInvalid(true);
            const group = rootRef.current?.closest('[role="radiogroup"]');
            const owner = group?.querySelector<HTMLElement>('[role="radio"]:not([aria-disabled="true"])');
            (owner ?? rootRef.current)?.focus();
          }}
        />
      )}
      <div
        ref={composeRefs(rootRef, ref)}
        role="radio"
        data-value={dataValue ?? value}
        aria-checked={isChecked}
        aria-disabled={disabled || undefined}
        aria-invalid={resolvedAriaInvalid}
        aria-label={ariaLabel}
        aria-labelledby={!ariaLabel && label ? labelId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={!disabled && isTabTarget ? 0 : -1}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        onMouseEnter={onMouseEnter}
        className={cn(
          selectableVariants({ highlighted, disabled }),
          selectableContainerClass,
          description && "items-start",
          className
        )}
      >
        <span
          aria-hidden="true"
          className={selectableIndicatorVariants({
            size,
            checked: isChecked,
            highlighted,
          })}
        >
          {selectableIndicators[variant][isChecked ? "checked" : "unchecked"]}
        </span>
        {label && (
          <div
            className={cn(
              "flex flex-col min-w-0",
              !description && "justify-center"
            )}
          >
            <span id={labelId} className={selectableLabelVariants({ size })}>{label}</span>
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
