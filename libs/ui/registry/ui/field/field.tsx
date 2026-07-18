"use client";

import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { mergeIds } from "@/lib/aria";
import { cn } from "@/lib/utils";
import {
  FieldContext,
  type FieldSlot,
  type FieldSlotRegistration,
  hasRenderableContent,
} from "./field-context";
import { FieldControl } from "./field-control";
import { FieldDescription } from "./field-description";
import { FieldError } from "./field-error";
import { FieldLabel } from "./field-label";

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

/** Props for field. */
export interface FieldProps extends ComponentProps<"div"> {
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

export function Field({
  controlId,
  invalid = false,
  required,
  disabled,
  className,
  children,
  ref,
  ...props
}: FieldProps) {
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

  // Direct children win from render (SSR/first-paint parity); effect
  // registrations only fill slots for wrapped or dynamic children.
  const labelSlot = seed.directSlots.has("label") ? seed.slots.label : slots.label;
  const descriptionSlot = seed.directSlots.has("description")
    ? seed.slots.description
    : slots.description;
  const errorSlot = seed.directSlots.has("error") ? seed.slots.error : slots.error;
  const labelId = labelSlot?.hasContent ? labelSlot.id : undefined;
  const descriptionId = descriptionSlot?.hasContent ? descriptionSlot.id : undefined;
  const errorId = errorSlot?.hasContent ? errorSlot.id : undefined;
  const describedBy = mergeIds(descriptionId, invalid ? errorId : undefined);
  const contextValue = useMemo(
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
