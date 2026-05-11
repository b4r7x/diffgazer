"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type AriaAttributes,
  type HTMLAttributes,
  type LabelHTMLAttributes,
  type ReactElement,
  type Ref,
} from "react";
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
  setLabelId: (value: string | undefined) => void;
  setDescriptionId: (value: string | undefined) => void;
  setErrorId: (value: string | undefined) => void;
}

const FieldContext = createContext<FieldContextValue | undefined>(undefined);

function useFieldContext(source: string) {
  const context = useContext(FieldContext);
  if (!context) throw new Error(`${source} must be used within Field`);
  return context;
}

function mergeIds(...values: Array<string | undefined>) {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export interface FieldRootProps extends HTMLAttributes<HTMLDivElement> {
  controlId?: string;
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
  ref?: Ref<HTMLDivElement>;
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
  const [labelId, setLabelId] = useState<string | undefined>(undefined);
  const [descriptionId, setDescriptionId] = useState<string | undefined>(undefined);
  const [errorId, setErrorId] = useState<string | undefined>(undefined);
  const describedBy = mergeIds(
    descriptionId,
    invalid ? errorId : undefined,
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
      setLabelId,
      setDescriptionId,
      setErrorId,
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
  const { controlId, required, defaultLabelId, setLabelId } = useFieldContext("Field.Label");
  const resolvedId = id ?? defaultLabelId;

  useEffect(() => {
    setLabelId(resolvedId);
    return () => setLabelId(undefined);
  }, [resolvedId, setLabelId]);

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
    "aria-labelledby": child.props["aria-labelledby"] ?? labelId,
    ref: composeRefs(child.props.ref, ref),
  });
}

export interface FieldDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  ref?: Ref<HTMLParagraphElement>;
}

function FieldDescription({ className, children, ref, ...props }: FieldDescriptionProps) {
  const { defaultDescriptionId, setDescriptionId } = useFieldContext("Field.Description");
  const hasChildren = children !== undefined && children !== null;
  const resolvedId = props.id ?? defaultDescriptionId;

  useEffect(() => {
    if (!hasChildren) return;
    setDescriptionId(resolvedId);
    return () => setDescriptionId(undefined);
  }, [hasChildren, resolvedId, setDescriptionId]);

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
  const { defaultErrorId, setErrorId } = useFieldContext("Field.Error");
  const hasChildren = children !== undefined && children !== null;
  const resolvedId = props.id ?? defaultErrorId;

  useEffect(() => {
    if (!hasChildren) return;
    setErrorId(resolvedId);
    return () => setErrorId(undefined);
  }, [hasChildren, resolvedId, setErrorId]);

  if (!hasChildren) return null;

  return (
    <p
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
