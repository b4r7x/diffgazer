"use client";

import {
  Children,
  type ComponentProps,
  isValidElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSelectableCollection } from "@/lib/selectable-collection";
import { isStepInteractive, type StepStatus } from "@/lib/step-status";
import { type StepperVariant, stepperRootVariants } from "@/lib/stepper-variants";
import { cn } from "@/lib/utils";
import { StepperContext } from "./stepper-context";
import { StepperStep, type StepperStepProps } from "./stepper-step";
import { StepperTrigger, type StepperTriggerProps } from "./stepper-trigger";
import { useStepperState } from "./use-state";

/** Props for stepper. */
export interface StepperProps extends Omit<ComponentProps<"ol">, "children"> {
  /** Controlled set of currently expanded step ids. */
  expandedIds?: string[];
  /** Initial expanded ids for uncontrolled mode. */
  defaultExpandedIds?: string[];
  /** Fired when the expanded set changes. */
  onExpandedChange?: (ids: string[]) => void;
  /** Visual variant. Controls the indicator glyph and connector treatment across every step. */
  variant?: StepperVariant;
  /** StepperStep children rendered inside an <ol>. */
  children: ReactNode;
}

interface StepDescriptor {
  id: string;
  status: StepStatus;
  label: string | undefined;
  disabled: boolean;
}

type StepRegistrationDescriptor = Omit<StepDescriptor, "disabled">;

// First-render/SSR seed for directly-composed steps: registration effects have
// not run yet, so resolve the active step from the static child tree. Once the
// steps mount, the registrations below are authoritative and also cover steps
// (or triggers) rendered through consumer wrapper components.
function collectStepSeed(children: ReactNode): StepDescriptor[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== StepperStep) return [];
    const props = child.props as StepperStepProps;
    const trigger = extractTriggerSeed(props.children);
    return [
      {
        id: props.stepId,
        status: props.status,
        label: trigger.label,
        disabled: !isStepInteractive(props.status) || trigger.disabled,
      },
    ];
  });
}

function extractTriggerSeed(children: ReactNode): Pick<StepDescriptor, "label" | "disabled"> {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== StepperTrigger) continue;
    const props = child.props as StepperTriggerProps;
    const label =
      typeof props.children === "string" ? props.children.trim() || undefined : undefined;
    return { label, disabled: props.disabled === true };
  }
  return { label: undefined, disabled: false };
}

function isRegisteredStepDisabled(status: StepStatus, element: HTMLElement | null): boolean {
  if (!isStepInteractive(status)) return true;
  return element?.querySelector<HTMLButtonElement>("[data-step-id]")?.disabled === true;
}

/** Root provider (manages expansion + variant) */
export function Stepper({
  expandedIds,
  defaultExpandedIds,
  onExpandedChange,
  variant = "ascii",
  className,
  children,
  onKeyDown,
  ...props
}: StepperProps) {
  const { expandedIds: expanded, toggle } = useStepperState({
    expandedIds,
    defaultExpandedIds,
    onExpandedChange,
  });

  const listRef = useRef<HTMLOListElement>(null);

  // Steps register through the selectable collection (DOM-ordered), while their
  // status/label travel in a side state map keyed by registrationId so the active
  // step and live-region announcement track the rendered order, including steps
  // or triggers composed through consumer wrappers.
  const [stepMeta, setStepMeta] = useState<
    Record<string, { status: StepStatus; label: string | undefined }>
  >({});
  const {
    items: registeredSteps,
    registerItem: registerCollectionItem,
    unregisterItem: unregisterCollectionItem,
  } = useSelectableCollection(listRef);
  const registerStep = useCallback(
    (
      registrationId: string,
      descriptor: StepRegistrationDescriptor,
      element: HTMLElement | null,
    ) => {
      setStepMeta((current) => {
        const existing = current[registrationId];
        if (existing?.status === descriptor.status && existing.label === descriptor.label) {
          return current;
        }
        return {
          ...current,
          [registrationId]: { status: descriptor.status, label: descriptor.label },
        };
      });
      registerCollectionItem(
        registrationId,
        descriptor.id,
        isRegisteredStepDisabled(descriptor.status, element),
        element,
      );
    },
    [registerCollectionItem],
  );
  const unregisterStep = useCallback(
    (registrationId: string) => {
      setStepMeta((current) => {
        if (!(registrationId in current)) return current;
        const { [registrationId]: _removed, ...rest } = current;
        return rest;
      });
      unregisterCollectionItem(registrationId);
    },
    [unregisterCollectionItem],
  );
  const syncRegisteredDisabledState = useCallback(() => {
    for (const item of registeredSteps) {
      const meta = stepMeta[item.id];
      const disabled = isRegisteredStepDisabled(meta?.status ?? "pending", item.element);
      if (item.disabled === disabled) continue;
      registerCollectionItem(item.id, item.value, disabled, item.element);
    }
  }, [registeredSteps, stepMeta, registerCollectionItem]);

  useLayoutEffect(() => {
    syncRegisteredDisabledState();
  }, [syncRegisteredDisabledState]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const View = list?.ownerDocument.defaultView;
    if (!list || !View?.MutationObserver) return;

    const observer = new View.MutationObserver(syncRegisteredDisabledState);
    observer.observe(list, { attributeFilter: ["disabled"], attributes: true, subtree: true });

    return () => observer.disconnect();
  }, [syncRegisteredDisabledState]);

  const seed = useMemo(() => collectStepSeed(children), [children]);
  const steps = useMemo<StepDescriptor[]>(
    () =>
      registeredSteps.length
        ? registeredSteps.map((item) => {
            const meta = stepMeta[item.id];
            return {
              id: item.value,
              status: meta?.status ?? "pending",
              label: meta?.label,
              disabled: item.disabled,
            };
          })
        : seed,
    [registeredSteps, stepMeta, seed],
  );
  const tabTargetId = useMemo(() => {
    const interactive = steps.filter((step) => !step.disabled && isStepInteractive(step.status));
    const target = interactive.find((step) => step.status === "active") ?? interactive[0];
    return target?.id ?? null;
  }, [steps]);

  // Note: Stepper implements its own roving focus instead of using
  // @diffgazer/keys useNavigation. The navigation contract differs: Stepper
  // items use `data-step-id` attribute selectors and filter by
  // `aria-disabled`, while useNavigation uses `data-value` + role-based
  // selectors. Routing through useNavigation would require rewriting the
  // step trigger data contract, which is a public API change.
  const moveFocus = (next: (count: number, current: number) => number) => {
    const list = listRef.current;
    if (!list) return false;
    const triggers = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-step-id]")).filter(
      (el) => el.getAttribute("aria-disabled") !== "true" && !el.disabled,
    );
    if (triggers.length === 0) return false;
    const activeElement = list.ownerDocument.activeElement;
    const ButtonCtor = list.ownerDocument.defaultView?.HTMLButtonElement;
    const currentIndex =
      ButtonCtor && activeElement instanceof ButtonCtor ? triggers.indexOf(activeElement) : -1;
    const nextIndex = next(triggers.length, currentIndex);
    const target = triggers[nextIndex];
    if (!target) return false;
    target.focus();
    return true;
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLOListElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const target = event.target as HTMLElement | null;
    // Only react when focus is on one of our triggers (so editable targets
    // in step content keep their native handling).
    if (!target?.hasAttribute("data-step-id")) return;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight": {
        if (moveFocus((count, current) => (current === -1 ? 0 : (current + 1) % count))) {
          event.preventDefault();
        }
        return;
      }
      case "ArrowUp":
      case "ArrowLeft": {
        if (
          moveFocus((count, current) =>
            current === -1 ? count - 1 : (current - 1 + count) % count,
          )
        ) {
          event.preventDefault();
        }
        return;
      }
      case "Home": {
        if (moveFocus(() => 0)) event.preventDefault();
        return;
      }
      case "End": {
        if (moveFocus((count) => count - 1)) event.preventDefault();
        return;
      }
    }
  };

  const ctx = useMemo(
    () => ({
      expandedIds: expanded,
      onToggle: toggle,
      variant,
      tabTargetId,
      registerStep,
      unregisterStep,
    }),
    [expanded, toggle, variant, tabTargetId, registerStep, unregisterStep],
  );

  const activeStep = steps.find((step) => step.status === "active");
  const activeIndex = activeStep ? steps.findIndex((step) => step.id === activeStep.id) : -1;

  return (
    <StepperContext value={ctx}>
      {/* biome-ignore lint/a11y/useSemanticElements: this already is an <ol>; the explicit role="list" below restores list semantics that Tailwind preflight strips, and Biome should not suggest swapping the element. */}
      <ol
        ref={listRef}
        // biome-ignore lint/a11y/noRedundantRoles: Tailwind preflight sets list-style:none on <ol>, which drops list semantics in Safari/VoiceOver; role="list" restores them.
        role="list"
        aria-label="Progress steps"
        {...props}
        data-slot="stepper"
        data-variant={variant}
        data-orientation="vertical"
        onKeyDown={handleKeyDown}
        className={cn(stepperRootVariants({ variant }), className)}
      >
        {children}
      </ol>
      <StepperLiveRegion
        label={activeStep?.label}
        position={activeStep ? activeIndex + 1 : null}
        total={steps.length}
      />
    </StepperContext>
  );
}

/** Props for stepper live region. */
interface StepperLiveRegionProps {
  /** Accessible label text. */
  label: string | undefined;
  /** Placement position. */
  position: number | null;
  /** Total item count. */
  total: number;
}

function StepperLiveRegion({ label, position, total }: StepperLiveRegionProps) {
  let message = "";
  if (position !== null) {
    message = label ? `Step ${position} of ${total}: ${label}` : `Step ${position} of ${total}`;
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="status" is the sr-only live region announcing step changes; <output> carries form-association semantics that do not fit here.
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
