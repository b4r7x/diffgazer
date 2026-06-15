"use client";

import {
  type AriaAttributes,
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { mergeIds, resolveAriaInvalid } from "@/lib/aria";
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

/** Allowed radio size values. */
export type RadioSize = SelectableSize;

const RADIO_CHECK_EVENT = "diffgazer:radio-check";

interface RadioCheckEventDetail {
  name: string;
  form: HTMLFormElement | null;
  source: HTMLElement;
}

function dispatchRadioCheck(source: HTMLElement, name: string) {
  source.ownerDocument.dispatchEvent(
    new CustomEvent<RadioCheckEventDetail>(RADIO_CHECK_EVENT, {
      detail: {
        name,
        form: source.closest("form"),
        source,
      },
    }),
  );
}

/** Props for radio root. */
type RadioRootProps = Omit<
  ComponentPropsWithRef<"div">,
  | "children"
  | "role"
  | "aria-checked"
  | "aria-disabled"
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

/** Props for radio. */
export interface RadioProps extends RadioRootProps {
  /** Controlled checked state. */
  checked?: boolean;
  /** Initial checked state for uncontrolled usage. */
  defaultChecked?: boolean;
  /** Whether radio is tab target. */
  isTabTarget?: boolean;
  /** Called when the boolean checked state changes. */
  onChange?: (checked: boolean) => void;
  /** Visible label associated with the custom radio. */
  label?: ReactNode;
  /** Visible description wired with aria-describedby. */
  description?: ReactNode;
  /** Disables the custom control and hidden input. */
  disabled?: boolean;
  /** Marks the item as highlighted by a parent collection. */
  highlighted?: boolean;
  /** Selectable control size token. */
  size?: RadioSize;
  /** Hidden native input name used for same-name radio behavior and form submission. */
  name?: string;
  /** Hidden native input value used for form submission. */
  value?: string;
  /** Marks the hidden native radio input as required. */
  required?: boolean;
  /** Indicator style. */
  variant?: SelectableVariant;
  /** Accessible name when no visible label is supplied. */
  "aria-label"?: string;
  /** ID of the element that labels this component. */
  "aria-labelledby"?: string;
  /** ID of the element that describes this component. */
  "aria-describedby"?: string;
  /** ARIA invalid state forwarded to the rendered control. */
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  /** Called when native invalid occurs. */
  onNativeInvalid?: () => void;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
  /** Value exposed as a data attribute for styling and selectors. */
  "data-value"?: string;
}

/**
 * Standalone radio button. Same-name standalone radios stay mutually exclusive
 * via a document-level CustomEvent, but they are form-submission-only: they have
 * no arrow-key navigation and each is its own tab stop. For a keyboard-complete
 * group (roving focus, arrow navigation, single tab stop) use RadioGroup.
 */
export function Radio({
  checked,
  defaultChecked = false,
  isTabTarget = true,
  onChange,
  onClick,
  onKeyDown,
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
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  onNativeInvalid,
  className,
  ref,
  "data-value": dataValue,
  ...rootProps
}: RadioProps) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const descriptionId = `${generatedId}-desc`;

  const rootRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const [isChecked, setIsChecked, isControlled] = useControllableState<boolean>({
    value: checked,
    defaultValue: defaultChecked,
    onChange,
  });
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

  useFormReset(
    rootRef,
    defaultChecked,
    (value) => {
      setNativeInvalid(false);
      setIsChecked(value);
    },
    checked === undefined,
  );

  const notifySameNameRadios = useCallback(() => {
    if (!name || !rootRef.current) return;
    dispatchRadioCheck(rootRef.current, name);
  }, [name]);

  useEffect(() => {
    if (!name || isControlled) return;

    const ownerDocument = rootRef.current?.ownerDocument;
    if (!ownerDocument) return;

    const handleRadioCheck = (event: Event) => {
      const detail = (event as CustomEvent<Partial<RadioCheckEventDetail> | undefined>).detail;
      if (
        !detail ||
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
          onInvalid={(event) => {
            event.preventDefault();
            onNativeInvalid?.();
            if (!onNativeInvalid) setNativeInvalid(true);
            const group = rootRef.current?.closest('[role="radiogroup"]');
            const owner = group?.querySelector<HTMLElement>(
              '[role="radio"]:not([aria-disabled="true"])',
            );
            (owner ?? rootRef.current)?.focus();
          }}
        />
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: this is the custom-styled radio control; a hidden native <input type="radio"> (rendered separately) owns form submission, so the visible control uses role="radio". */}
      <div
        {...rootProps}
        ref={composedRef}
        role="radio"
        data-slot="radio"
        data-value={dataValue ?? value}
        data-state={isChecked ? "checked" : "unchecked"}
        data-disabled={disabled ? "" : undefined}
        data-highlighted={highlighted ? "" : undefined}
        aria-checked={isChecked}
        aria-disabled={disabled || undefined}
        aria-invalid={resolvedAriaInvalid}
        aria-label={ariaLabel}
        aria-labelledby={resolvedAriaLabelledBy}
        aria-describedby={resolvedAriaDescribedBy}
        tabIndex={!disabled && isTabTarget ? 0 : -1}
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
          <div className={cn("flex flex-col min-w-0", !description && "justify-center")}>
            <span id={labelId} className={selectableLabelVariants({ size })}>
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
