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

interface FieldContextValue {
  controlId: string;
  defaultLabelId: string;
  defaultDescriptionId: string;
  defaultErrorId: string;
  invalid: boolean;
  required: boolean | undefined;
  disabled: boolean | undefined;
  controlRef: RefObject<HTMLElement | null>;
  labelId: string | undefined;
  describedBy: string | undefined;
  registerControlId: (id: string | null) => void;
  registerSlot: (slot: FieldSlot, registration: FieldSlotRegistration) => void;
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

function isDisabledControl(element: HTMLElement, fieldDisabled: boolean | undefined): boolean {
  return (
    fieldDisabled === true ||
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true"
  );
}

interface FieldChildProps {
  id?: string;
  children?: ReactNode;
}

interface FieldSeed {
  slots: Partial<Record<FieldSlot, FieldSlotRegistration>>;
  directSlots: Set<FieldSlot>;
  controlId: string | null;
  hasDirectControl: boolean;
}

/**
 * Resolves slot/control ids from direct children during render so SSR and the first client
 * paint carry the same ARIA relationships the effects establish after hydration. Wrapped or
 * dynamic children fall back to the effect registrations.
 */
function seedFieldFromChildren(
  children: ReactNode,
  ids: { label: string; description: string; error: string },
  invalid: boolean,
): FieldSeed {
  const slots: Partial<Record<FieldSlot, FieldSlotRegistration>> = {};
  const directSlots = new Set<FieldSlot>();
  let controlId: string | null = null;
  let hasDirectControl = false;

  Children.forEach(children, (child) => {
    if (!isValidElement<FieldChildProps>(child)) return;
    if (child.type === FieldLabel) {
      directSlots.add("label");
      slots.label = {
        id: child.props.id ?? ids.label,
        hasContent: hasRenderableContent(child.props.children),
      };
    } else if (child.type === FieldDescription) {
      directSlots.add("description");
      slots.description = {
        id: child.props.id ?? ids.description,
        hasContent: hasRenderableContent(child.props.children),
      };
    } else if (child.type === FieldError) {
      directSlots.add("error");
      slots.error = {
        id: child.props.id ?? ids.error,
        hasContent: hasRenderableContent(child.props.children) && invalid,
      };
    } else if (child.type === FieldControl) {
      hasDirectControl = true;
      const control = child.props.children;
      controlId = isValidElement<FieldChildProps>(control) ? (control.props.id ?? null) : null;
    }
  });

  return { slots, directSlots, controlId, hasDirectControl };
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

  const seed = seedFieldFromChildren(
    children,
    { label: defaultLabelId, description: defaultDescriptionId, error: defaultErrorId },
    invalid,
  );

  // A consumer id on the Control child wins. A direct control is authoritative
  // from render; a wrapped control reports its resolved id through the effect.
  const resolvedControlId = seed.hasDirectControl
    ? (seed.controlId ?? baseControlId)
    : (registeredControlId ?? baseControlId);

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

  // Direct children win from render; wrapped children fall back to their effect
  // registration. Only labels present in the tree are exposed, otherwise
  // aria-labelledby would point at a missing element.
  const labelSlot = seed.directSlots.has("label") ? seed.slots.label : slots.label;
  const descriptionSlot = seed.directSlots.has("description")
    ? seed.slots.description
    : slots.description;
  const errorSlot = seed.directSlots.has("error") ? seed.slots.error : slots.error;

  const labelId = labelSlot?.hasContent ? labelSlot.id : undefined;
  const descriptionId = descriptionSlot?.hasContent ? descriptionSlot.id : undefined;
  const errorId = errorSlot?.hasContent ? errorSlot.id : undefined;
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

function FieldLabel({ className, children, ref, id, onClick, ...props }: FieldLabelProps) {
  const {
    controlId,
    required,
    disabled,
    defaultLabelId,
    controlRef,
    registerSlot,
    unregisterSlot,
  } = useFieldContext("Field.Label");
  const hasChildren = hasRenderableContent(children);
  const resolvedId = id ?? defaultLabelId;

  useLayoutEffect(() => {
    registerSlot("label", { id: resolvedId, hasContent: hasChildren });
    return () => unregisterSlot("label");
  }, [registerSlot, unregisterSlot, resolvedId, hasChildren]);

  const handleClick = (event: ReactMouseEvent<HTMLLabelElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    // htmlFor only activates labelable elements; div-based Checkbox/Radio need manual focus+click.
    const control = controlRef.current;
    if (control && !isLabelableElement(control)) {
      event.preventDefault();
      if (isDisabledControl(control, disabled)) return;
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

interface FieldControlChildProps {
  id?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
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
    disabled: disabled || child.props.disabled || undefined,
    required: child.props.required ?? required,
    "aria-invalid": child.props["aria-invalid"] ?? (invalid ? true : undefined),
    "aria-describedby": mergeIds(child.props["aria-describedby"], describedBy),
    "aria-labelledby": mergeIds(child.props["aria-labelledby"], labelId),
    ref: composedRef,
  });
}

/** Props for field description. */
export interface FieldDescriptionProps extends ComponentProps<"p"> {}

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
