"use client";

import {
  type AriaAttributes,
  Children,
  cloneElement,
  type ReactElement,
  type Ref,
  useLayoutEffect,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { mergeIds } from "@/lib/aria";
import { useFieldContext } from "./field-context";

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
  /**
   * Single child control. Field clones it with id, disabled, required, aria-invalid,
   * aria-describedby, and aria-labelledby. If the child supplies its own id, that id wins and
   * Field.Label's htmlFor follows it.
   */
  children: ReactElement<FieldControlChildProps>;
  ref?: Ref<HTMLElement>;
}

export function FieldControl({ children, ref }: FieldControlProps) {
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
  const childId = child.props.id;
  const resolvedId = childId ?? controlId;
  const composedRef = useComposedRefs(child.props.ref, controlRef, ref);

  useLayoutEffect(() => {
    registerControlId(childId ?? null);
    return () => registerControlId(null);
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
