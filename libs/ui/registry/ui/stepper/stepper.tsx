"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  stepperRootVariants,
  type StepperVariant,
} from "@/lib/stepper-variants";
import { isStepInteractive, type StepStatus } from "@/lib/step-status";
import { StepperContext } from "./stepper-context";
import { StepperStep, type StepperStepProps } from "./stepper-step";
import { StepperTrigger, type StepperTriggerProps } from "./stepper-trigger";
import { useStepperState } from "./use-stepper-state";

export interface StepperProps
  extends Omit<ComponentProps<"ol">, "children"> {
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /**
   * Visual variant:
   *   - `ascii` — `[x] [~] [ ] [!]` mono 1ch glyph, blinking `~` on active.
   *   - `numbered` — 20px square with CSS-counter step number; ✓ on completed.
   *   - `bullet` — single Unicode glyph, dashed connector for low chrome.
   *   - `tag` — uppercase text tag (DONE/RUN/WAIT/FAIL/SKIP/OFF) with fixed
   *     `min-width` so active state does not shift neighbour widths.
   *   - `progress` — `███ / █▌░ / ░░░` Unicode block-element bar per step.
   */
  variant?: StepperVariant;
  children: ReactNode;
}

interface StepDescriptor {
  id: string;
  status: StepStatus;
  label: string | undefined;
}

/**
 * Walk direct children for StepperStep elements. Direct-children only matches
 * the existing composition contract; wrappers that synthesize steps are not
 * supported. Returns step ids + statuses (and the trigger label when it is a
 * plain string) in DOM order.
 */
function collectSteps(children: ReactNode): StepDescriptor[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== StepperStep) return [];
    const props = child.props as StepperStepProps;
    return [{ id: props.stepId, status: props.status, label: extractTriggerLabel(props.children) }];
  });
}

/**
 * Walk a step's children for the direct `StepperTrigger` child and return its
 * label when it is a plain string. Non-string children (icons, nested nodes)
 * return undefined; the live region falls back to "Step N of M" without label.
 */
function extractTriggerLabel(children: ReactNode): string | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== StepperTrigger) continue;
    const triggerChildren = (child.props as StepperTriggerProps).children;
    if (typeof triggerChildren === "string") return triggerChildren.trim() || undefined;
    return undefined;
  }
  return undefined;
}

/**
 * Stepper root.
 *
 * Implements a roving tabIndex: only one step trigger holds `tabIndex={0}` at
 * a time (the active step if interactive, otherwise the first interactive
 * step). Arrow keys move highlight, Home/End jump to first/last enabled,
 * disabled steps are skipped. Editable targets inside step content keep their
 * native keyboard handling.
 *
 * The live region announces "Step {n} of {total}: {label}" when a step's
 * status flips to active. Label is sourced from the active step's
 * `StepperTrigger` children via `extractTriggerLabel` (string children only).
 */
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
  const moveFocus = useCallback(
    (next: (count: number, current: number) => number) => {
      const list = listRef.current;
      if (!list) return false;
      const triggers = Array.from(
        list.querySelectorAll<HTMLButtonElement>("[data-step-id]"),
      ).filter((el) => el.getAttribute("aria-disabled") !== "true");
      if (triggers.length === 0) return false;
      const activeElement = list.ownerDocument.activeElement;
      const currentIndex = triggers.findIndex((el) => el === activeElement);
      const nextIndex = next(triggers.length, currentIndex);
      triggers[nextIndex]?.focus();
      return true;
    },
    [],
  );

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
          if (
            moveFocus((count, current) =>
              current === -1 ? 0 : (current + 1) % count,
            )
          ) {
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
  const activeIndex = activeStep
    ? steps.findIndex((step) => step.id === activeStep.id)
    : -1;

  return (
    <StepperContext value={ctx}>
      <ol
        ref={listRef}
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

/**
 * Polite live region. Keyed by the active step id so React tears down and
 * remounts on each transition — guarantees the announcement is read even if
 * the label text happens to be identical.
 */
function StepperLiveRegion({ activeStepId, label, position, total }: StepperLiveRegionProps) {
  const message = label
    ? `Step ${position} of ${total}: ${label}`
    : `Step ${position} of ${total}`;
  return (
    <div
      key={activeStepId}
      role="status"
      aria-live="polite"
      className="sr-only"
    >
      {message}
    </div>
  );
}
