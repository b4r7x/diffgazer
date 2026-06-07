"use client";

import {
  Children,
  type ComponentProps,
  isValidElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { isStepInteractive, type StepStatus } from "@/lib/step-status";
import { type StepperVariant, stepperRootVariants } from "@/lib/stepper-variants";
import { cn } from "@/lib/utils";
import { StepperContext } from "./stepper-context";
import { StepperStep, type StepperStepProps } from "./stepper-step";
import { StepperTrigger, type StepperTriggerProps } from "./stepper-trigger";
import { useStepperState } from "./use-state";

export interface StepperProps extends Omit<ComponentProps<"ol">, "children"> {
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  variant?: StepperVariant;
  children: ReactNode;
}

interface StepDescriptor {
  id: string;
  status: StepStatus;
  label: string | undefined;
}

function collectSteps(children: ReactNode): StepDescriptor[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== StepperStep) return [];
    const props = child.props as StepperStepProps;
    return [{ id: props.stepId, status: props.status, label: extractTriggerLabel(props.children) }];
  });
}

function extractTriggerLabel(children: ReactNode): string | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== StepperTrigger) continue;
    const triggerChildren = (child.props as StepperTriggerProps).children;
    if (typeof triggerChildren === "string") return triggerChildren.trim() || undefined;
    return undefined;
  }
  return undefined;
}

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

  const steps = useMemo(() => collectSteps(children), [children]);
  const tabTargetId = useMemo(() => {
    const interactive = steps.filter((step) => isStepInteractive(step.status));
    const target = interactive.find((step) => step.status === "active") ?? interactive[0];
    return target?.id ?? null;
  }, [steps]);

  // Note: Stepper implements its own roving focus instead of using
  // @diffgazer/keys useNavigation. The navigation contract differs: Stepper
  // items use `data-step-id` attribute selectors and filter by
  // `aria-disabled`, while useNavigation uses `data-value` + role-based
  // selectors. Routing through useNavigation would require rewriting the
  // step trigger data contract, which is a public API change.
  const moveFocus = useCallback((next: (count: number, current: number) => number) => {
    const list = listRef.current;
    if (!list) return false;
    const triggers = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-step-id]")).filter(
      (el) => el.getAttribute("aria-disabled") !== "true",
    );
    if (triggers.length === 0) return false;
    const activeElement = list.ownerDocument.activeElement;
    const currentIndex =
      activeElement instanceof HTMLButtonElement ? triggers.indexOf(activeElement) : -1;
    const nextIndex = next(triggers.length, currentIndex);
    const target = triggers[nextIndex];
    if (!target) return false;
    target.focus();
    return true;
  }, []);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLOListElement>) => {
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
    },
    [moveFocus, onKeyDown],
  );

  const ctx = useMemo(
    () => ({ expandedIds: expanded, onToggle: toggle, variant, tabTargetId }),
    [expanded, toggle, variant, tabTargetId],
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
        data-variant={variant}
        data-orientation="vertical"
        onKeyDown={handleKeyDown}
        className={cn(stepperRootVariants({ variant }), className)}
      >
        {children}
      </ol>
      {activeStep && (
        <StepperLiveRegion
          activeStepId={activeStep.id}
          label={activeStep.label}
          position={activeIndex + 1}
          total={steps.length}
        />
      )}
    </StepperContext>
  );
}

interface StepperLiveRegionProps {
  activeStepId: string;
  label: string | undefined;
  position: number;
  total: number;
}

function StepperLiveRegion({ activeStepId, label, position, total }: StepperLiveRegionProps) {
  const message = label ? `Step ${position} of ${total}: ${label}` : `Step ${position} of ${total}`;
  return (
    // biome-ignore lint/a11y/useSemanticElements: role="status" is the sr-only live region announcing step changes; <output> carries form-association semantics that do not fit here.
    <div key={activeStepId} role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
