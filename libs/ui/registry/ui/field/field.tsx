"use client";

import {
  type AriaAttributes,
  Children,
  type ComponentProps,
  cloneElement,
  createContext,
  isValidElement,
  type LabelHTMLAttributes,
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { mergeIds } from "@/lib/aria";
import { cn } from "@/lib/utils";

type FieldSlot = "label" | "description" | "error";

interface FieldSlotRegistration {
  id: string;
  hasContent: boolean;
}

/** Context value shared by field. */
interface FieldContextValue {
  /** Override the auto-generated id used by the wrapped control, label, description, and error. */
  controlId: string;
  /** DOM id for default label. */
  defaultLabelId: string;
  /** DOM id for default description. */
  defaultDescriptionId: string;
  /** DOM id for default error. */
  defaultErrorId: string;
  /**
   * Marks the control as invalid; sets aria-invalid and surfaces Field.Error in
   * aria-describedby.
   */
  invalid: boolean;
  /** Marks the control as required and shows a required indicator next to Field.Label. */
  required: boolean | undefined;
  /** Disables the control and applies data-disabled to the field root. */
  disabled: boolean | undefined;
  /** Ref for the control element. */
  controlRef: RefObject<HTMLElement | null>;
  /** DOM id for label. */
  labelId: string | undefined;
  /** described by used by field. */
  describedBy: string | undefined;
  /** Registers control id with field. */
  registerControlId: (id: string | null) => void;
  /** Registers slot with field. */
  registerSlot: (slot: FieldSlot, registration: FieldSlotRegistration) => void;
  /** Unregisters slot from field. */
  unregisterSlot: (slot: FieldSlot) => void;
}

const FieldContext = createContext<FieldContextValue | undefined>(undefined);

function useFieldContext(source: string) {
  const context = useContext(FieldContext);
  if (!context) throw new Error(`${source} must be used within Field`);
  return context;
}

function hasRenderableContent(children: ReactNode): boolean {
  if (children === null || children === undefined || typeof children === "boolean") return false;
  if (typeof children === "string") return children.length > 0;
  if (typeof children === "number") return true;
  if (Array.isArray(children)) return children.some(hasRenderableContent);
  return true;
}

const LABELABLE_TAGS = new Set([
  "BUTTON",
  "INPUT",
  "METER",
  "OUTPUT",
  "PROGRESS",
  "SELECT",
  "TEXTAREA",
]);

function isLabelableElement(element: HTMLElement | null): boolean {
  return element !== null && LABELABLE_TAGS.has(element.tagName);
}

/** Props for field root. */
export interface FieldRootProps extends ComponentProps<"div"> {
  /** Override the auto-generated id used by the wrapped control, label, description, and error. */
  controlId?: string;
  /**
   * Marks the control as invalid; sets aria-invalid and surfaces Field.Error in
   * aria-describedby.
   */
  invalid?: boolean;
  /** Marks the control as required and shows a required indicator next to Field.Label. */
  required?: boolean;
  /** Disables the control and applies data-disabled to the field root. */
  disabled?: boolean;
}

/**
 * Form field primitives that wire labels, controls, descriptions, and validation messages
 * without owning the actual input component.
 */
function FieldRoot({
  controlId,
  invalid = false,
  required,
  disabled,
  className,
  children,
  ref,
  ...props
}: FieldRootProps) {
  const generatedId = useId();
  const baseControlId = controlId ?? `${generatedId}-control`;
  const defaultLabelId = `${baseControlId}-label`;
  const defaultDescriptionId = `${baseControlId}-description`;
  const defaultErrorId = `${baseControlId}-error`;

  const controlRef = useRef<HTMLElement | null>(null);
  const [registeredControlId, setRegisteredControlId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Partial<Record<FieldSlot, FieldSlotRegistration>>>({});

  // A consumer id on the Control child wins; FieldControl reports the resolved
  // id so Field.Label's htmlFor follows the real control.
  const resolvedControlId = registeredControlId ?? baseControlId;

  const registerControlId = useCallback((id: string | null) => {
    setRegisteredControlId((prev) => (prev === id ? prev : id));
  }, []);

  const registerSlot = useCallback((slot: FieldSlot, registration: FieldSlotRegistration) => {
    setSlots((prev) => {
      const existing = prev[slot];
      if (existing?.id === registration.id && existing.hasContent === registration.hasContent) {
        return prev;
      }
      return { ...prev, [slot]: registration };
    });
  }, []);

  const unregisterSlot = useCallback((slot: FieldSlot) => {
    setSlots((prev) => {
      if (!(slot in prev)) return prev;
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }, []);

  // aria-labelledby must be present on initial render (no effect dependency), so
  // fall back to the deterministic default label id until registration corrects
  // a consumer-supplied id.
  const labelId = slots.label?.id ?? defaultLabelId;
  const descriptionId = slots.description?.hasContent ? slots.description.id : undefined;
  const errorId = slots.error?.hasContent ? slots.error.id : undefined;
  const describedBy = mergeIds(descriptionId, invalid ? errorId : undefined);

  const contextValue = useMemo<FieldContextValue>(
    () => ({
      controlId: resolvedControlId,
      defaultLabelId,
      defaultDescriptionId,
      defaultErrorId,
      invalid,
      required,
      disabled,
      controlRef,
      labelId,
      describedBy,
      registerControlId,
      registerSlot,
      unregisterSlot,
    }),
    [
      resolvedControlId,
      defaultLabelId,
      defaultDescriptionId,
      defaultErrorId,
      invalid,
      required,
      disabled,
      labelId,
      describedBy,
      registerControlId,
      registerSlot,
      unregisterSlot,
    ],
  );

  return (
    <FieldContext value={contextValue}>
      <div
        {...props}
        ref={ref}
        data-slot="field"
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        className={cn("flex flex-col gap-1.5", className)}
      >
        {children}
      </div>
    </FieldContext>
  );
}

/** Props for field label. */
export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLLabelElement>;
}

/**
 * Form field primitives that wire labels, controls, descriptions, and validation messages
 * without owning the actual input component.
 */
function FieldLabel({ className, children, ref, id, onClick, ...props }: FieldLabelProps) {
  const { controlId, required, defaultLabelId, controlRef, registerSlot, unregisterSlot } =
    useFieldContext("Field.Label");
  const resolvedId = id ?? defaultLabelId;

  useLayoutEffect(() => {
    registerSlot("label", { id: resolvedId, hasContent: true });
    return () => unregisterSlot("label");
  }, [registerSlot, unregisterSlot, resolvedId]);

  const handleClick = (event: ReactMouseEvent<HTMLLabelElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    // Native htmlFor only activates labelable elements; div-based controls
    // (Checkbox/Radio) need a manual focus + activation to restore label-click parity.
    const control = controlRef.current;
    if (control && !isLabelableElement(control)) {
      event.preventDefault();
      control.focus();
      control.click();
    }
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: this onClick only forwards a label click to a div-based control; keyboard activation is owned by the control itself (Space/Enter when focused), so there is no keyboard equivalent on the label.
    <label
      {...props}
      ref={ref}
      id={resolvedId}
      data-slot="field-label"
      htmlFor={props.htmlFor ?? controlId}
      onClick={handleClick}
      className={cn("text-xs uppercase font-bold text-muted-foreground select-none", className)}
    >
      {children}
      {required && (
        <span className="text-error" aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </label>
  );
}

/** Props for field control child. */
interface FieldControlChildProps {
  /** ID applied to the rendered element. */
  id?: string;
  /** Disables the control and applies data-disabled to the field root. */
  disabled?: boolean;
  /** Marks the control as required and shows a required indicator next to Field.Label. */
  required?: boolean;
  /** ARIA invalid state forwarded to the rendered control. */
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  /** ID of the element that describes this component. */
  "aria-describedby"?: string;
  /** ID of the element that labels this component. */
  "aria-labelledby"?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLElement>;
}

/** Props for field control. */
export interface FieldControlProps {
  /**
   * Single child control. Field clones it with id, disabled, required, aria-invalid,
   * aria-describedby, and aria-labelledby. If the child supplies its own id, that id wins and
   * Field.Label's htmlFor follows it.
   */
  children: ReactElement<FieldControlChildProps>;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLElement>;
}

/**
 * Form field primitives that wire labels, controls, descriptions, and validation messages
 * without owning the actual input component.
 */
function FieldControl({ children, ref }: FieldControlProps) {
  const {
    controlId,
    describedBy,
    labelId,
    invalid,
    required,
    disabled,
    controlRef,
    registerControlId,
  } = useFieldContext("Field.Control");
  const child = Children.only(children);
  if (!isValidElement<FieldControlChildProps>(child)) {
    throw new Error("Field.Control expects a single React element child");
  }

  const childId = child.props.id;
  const resolvedId = childId ?? controlId;
  const composedRef = useComposedRefs(child.props.ref, controlRef, ref);

  useLayoutEffect(() => {
    registerControlId(childId ?? null);
  }, [childId, registerControlId]);

  return cloneElement(child, {
    id: resolvedId,
    disabled: child.props.disabled ?? disabled,
    required: child.props.required ?? required,
    "aria-invalid": child.props["aria-invalid"] ?? (invalid ? true : undefined),
    "aria-describedby": mergeIds(child.props["aria-describedby"], describedBy),
    "aria-labelledby": mergeIds(child.props["aria-labelledby"], labelId),
    ref: composedRef,
  });
}

/** Props for field description. */
export interface FieldDescriptionProps extends ComponentProps<"p"> {}

/**
 * Form field primitives that wire labels, controls, descriptions, and validation messages
 * without owning the actual input component.
 */
function FieldDescription({ className, children, ref, ...props }: FieldDescriptionProps) {
  const { defaultDescriptionId, registerSlot, unregisterSlot } =
    useFieldContext("Field.Description");
  const hasChildren = hasRenderableContent(children);
  const resolvedId = props.id ?? defaultDescriptionId;

  useLayoutEffect(() => {
    registerSlot("description", { id: resolvedId, hasContent: hasChildren });
    return () => unregisterSlot("description");
  }, [registerSlot, unregisterSlot, resolvedId, hasChildren]);

  if (!hasChildren) return null;

  return (
    <p
      {...props}
      ref={ref}
      id={resolvedId}
      data-slot="field-description"
      className={cn("text-xs text-muted-foreground", className)}
    >
      {children}
    </p>
  );
}

/** Props for field error. */
export interface FieldErrorProps extends ComponentProps<"p"> {}

/**
 * Form field primitives that wire labels, controls, descriptions, and validation messages
 * without owning the actual input component.
 */
function FieldError({ className, children, ref, ...props }: FieldErrorProps) {
  const { defaultErrorId, invalid, registerSlot, unregisterSlot } = useFieldContext("Field.Error");
  const hasChildren = hasRenderableContent(children);
  const resolvedId = props.id ?? defaultErrorId;
  const isRendered = hasChildren && invalid;

  useLayoutEffect(() => {
    registerSlot("error", { id: resolvedId, hasContent: isRendered });
    return () => unregisterSlot("error");
  }, [registerSlot, unregisterSlot, resolvedId, isRendered]);

  if (!isRendered) return null;

  return (
    <p
      role="alert"
      {...props}
      ref={ref}
      id={resolvedId}
      data-slot="field-error"
      className={cn("text-xs text-error", className)}
    >
      {children}
    </p>
  );
}

/**
 * Form field primitives that wire labels, controls, descriptions, and validation messages
 * without owning the actual input component.
 */
const Field = Object.assign(FieldRoot, {
  Label: FieldLabel,
  Control: FieldControl,
  Description: FieldDescription,
  Error: FieldError,
});

export { Field, FieldRoot, FieldLabel, FieldControl, FieldDescription, FieldError };
