"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
  useMemo,
  type AriaAttributes,
  type HTMLAttributes,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { mergeIds } from "@/lib/aria-utils";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";

interface FieldContextValue {
  controlId: string;
  defaultLabelId: string;
  labelId: string | undefined;
  defaultDescriptionId: string;
  defaultErrorId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean | undefined;
  disabled: boolean | undefined;
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

export interface FieldRootProps extends HTMLAttributes<HTMLDivElement> {
  controlId?: string;
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Form-field wrapper that wires a label, control, optional description, and
 * optional error message together via shared `id` and ARIA relationships.
 * The compound `Field.Label`, `Field.Control`, `Field.Description`, and
 * `Field.Error` children read state from this root so consumers only set
 * `invalid`, `required`, or `disabled` once.
 *
 * @example
 * ```tsx
 * <Field required invalid={Boolean(error)}>
 *   <Field.Label>Email</Field.Label>
 *   <Field.Control>
 *     <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
 *   </Field.Control>
 *   <Field.Description>We never share your address.</Field.Description>
 *   <Field.Error>{error}</Field.Error>
 * </Field>
 * ```
 */
/**
 * Scan direct Field children to detect which slots are present. Returns
 * deterministic IDs only for slots that are actually rendered, so ARIA
 * attributes are correct from the first render without useEffect.
 */
function detectFieldSlots(
  children: ReactNode,
  defaultLabelId: string,
  defaultDescriptionId: string,
  defaultErrorId: string,
  invalid: boolean,
) {
  let labelId: string | undefined;
  let descriptionId: string | undefined;
  let errorId: string | undefined;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === FieldLabel) {
      labelId = (child.props as FieldLabelProps).id ?? defaultLabelId;
    }
    if (child.type === FieldDescription) {
      const descProps = child.props as FieldDescriptionProps & { children?: ReactNode };
      if (hasRenderableContent(descProps.children)) {
        descriptionId = descProps.id ?? defaultDescriptionId;
      }
    }
    if (child.type === FieldError) {
      const errProps = child.props as FieldErrorProps & { children?: ReactNode };
      if (hasRenderableContent(errProps.children)) {
        errorId = errProps.id ?? defaultErrorId;
      }
    }
  });

  const describedBy = mergeIds(
    descriptionId,
    invalid ? errorId : undefined,
  );

  return { labelId, descriptionId, errorId, describedBy };
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
  const resolvedControlId = controlId ?? `${generatedId}-control`;
  const defaultLabelId = `${resolvedControlId}-label`;
  const defaultDescriptionId = `${resolvedControlId}-description`;
  const defaultErrorId = `${resolvedControlId}-error`;

  const { labelId, describedBy } = detectFieldSlots(
    children,
    defaultLabelId,
    defaultDescriptionId,
    defaultErrorId,
    invalid,
  );

  const contextValue = useMemo(
    () => ({
      controlId: resolvedControlId,
      defaultLabelId,
      labelId,
      defaultDescriptionId,
      defaultErrorId,
      describedBy,
      invalid,
      required,
      disabled,
    }),
    [resolvedControlId, defaultLabelId, labelId, defaultDescriptionId, defaultErrorId, describedBy, invalid, required, disabled],
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

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  ref?: Ref<HTMLLabelElement>;
}

function FieldLabel({ className, children, ref, id, ...props }: FieldLabelProps) {
  const { controlId, required, defaultLabelId } = useFieldContext("Field.Label");
  const resolvedId = id ?? defaultLabelId;

  return (
    <label
      {...props}
      ref={ref}
      id={resolvedId}
      data-slot="field-label"
      htmlFor={props.htmlFor ?? controlId}
      className={cn("text-xs uppercase font-bold text-muted-foreground select-none", className)}
    >
      {children}
      {required && <span className="text-destructive" aria-hidden="true"> *</span>}
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

export interface FieldControlProps {
  children: ReactElement<FieldControlChildProps>;
  ref?: Ref<HTMLElement>;
}

function FieldControl({ children, ref }: FieldControlProps) {
  const { controlId, describedBy, labelId, invalid, required, disabled } = useFieldContext("Field.Control");
  const child = Children.only(children);
  if (!isValidElement<FieldControlChildProps>(child)) {
    throw new Error("Field.Control expects a single React element child");
  }

  return cloneElement(child, {
    id: child.props.id ?? controlId,
    disabled: child.props.disabled ?? disabled,
    required: child.props.required ?? required,
    "aria-invalid": child.props["aria-invalid"] ?? (invalid ? true : undefined),
    "aria-describedby": mergeIds(child.props["aria-describedby"], describedBy),
    "aria-labelledby": mergeIds(child.props["aria-labelledby"], labelId),
    ref: composeRefs(child.props.ref, ref),
  });
}

export interface FieldDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  ref?: Ref<HTMLParagraphElement>;
}

function FieldDescription({ className, children, ref, ...props }: FieldDescriptionProps) {
  const { defaultDescriptionId } = useFieldContext("Field.Description");
  const hasChildren = hasRenderableContent(children);
  const resolvedId = props.id ?? defaultDescriptionId;

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

export interface FieldErrorProps extends HTMLAttributes<HTMLParagraphElement> {
  ref?: Ref<HTMLParagraphElement>;
}

function FieldError({ className, children, ref, ...props }: FieldErrorProps) {
  const { defaultErrorId } = useFieldContext("Field.Error");
  const hasChildren = hasRenderableContent(children);
  const resolvedId = props.id ?? defaultErrorId;

  if (!hasChildren) return null;

  return (
    <p
      role="alert"
      {...props}
      ref={ref}
      id={resolvedId}
      data-slot="field-error"
      className={cn("text-xs text-destructive", className)}
    >
      {children}
    </p>
  );
}

const Field = Object.assign(FieldRoot, {
  Label: FieldLabel,
  Control: FieldControl,
  Description: FieldDescription,
  Error: FieldError,
});

export {
  Field,
  FieldRoot,
  FieldLabel,
  FieldControl,
  FieldDescription,
  FieldError,
};
