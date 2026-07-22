"use client";

import {
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useMemo,
  useRef,
} from "react";
import { type StepperVariant, stepperRootVariants } from "@/lib/stepper-variants";
import { cn } from "@/lib/utils";
import { StepperContext } from "./stepper-context";
import { handleStepListNavigationKey } from "./step-navigation";
import { useStepCollection } from "./use-step-collection";
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
  const { steps, tabTargetId, registerStep, unregisterStep } = useStepCollection(children, listRef);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLOListElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    handleStepListNavigationKey(event, listRef.current, event.target as HTMLElement | null);
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
