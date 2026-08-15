"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";
import { renderSelectableGlyph } from "@/lib/selectable-glyph";
import { cn } from "@/lib/utils";
import {
  type HorizontalStepStatus,
  useHorizontalStepperContext,
  useStepInfo,
} from "./horizontal-stepper-context";
import {
  HORIZONTAL_STEP_INDICATOR_GLYPHS,
  type HorizontalStepperVariant,
  horizontalStepperActiveOnlyCollapseClass,
  horizontalStepperBreadcrumbSeparatorClass,
  horizontalStepperCompletedConnectorClass,
  horizontalStepperConnectorClass,
  horizontalStepperConnectorDisplayClass,
  horizontalStepperConnectorItemClass,
  horizontalStepperCounterClass,
  horizontalStepperCounterVisibilityClass,
  horizontalStepperElisionClass,
  horizontalStepperGlyphVariants,
  horizontalStepperLabelVariants,
  horizontalStepperStepVariants,
  horizontalStepperWindowClasses,
} from "./horizontal-stepper-variants";

const SR_LABEL: Record<HorizontalStepStatus, string> = {
  completed: "Completed: ",
  active: "Current: ",
  pending: "Upcoming: ",
};

/** Props for horizontal stepper step. */
export interface HorizontalStepperStepProps {
  /** Step id matched against the parent value to derive status. */
  value: string;
  /** Step label. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Single horizontal step (derives status from parent value) */
export function HorizontalStepperStep({ value, children, className }: HorizontalStepperStepProps) {
  const { variant, compact, registerStep } = useHorizontalStepperContext();
  const { status, index, total, activeIndex } = useStepInfo(value);
  const itemRef = useRef<HTMLLIElement>(null);

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) return;
    return registerStep(value, item);
  }, [registerStep, value]);

  const showConnectorBefore = index > 0;
  const isActive = status === "active";
  const distance = index - activeIndex;
  const windowClasses = horizontalStepperWindowClasses(variant, total, compact);
  // The markers ride the two steps flanking the active one, so they read in run order
  // (`+2 [x] [~] [ ] +1`) while the list still holds exactly one <li> per step.
  const hiddenBefore = distance === -1 ? activeIndex - 1 : 0;
  const hiddenAfter = distance === 1 ? total - activeIndex - 2 : 0;

  const glyph = renderGlyph(variant, status);
  const connector = renderConnector(variant, status === "completed");

  return (
    <>
      {showConnectorBefore && connector !== null && (
        <li
          role="presentation"
          aria-hidden="true"
          className={cn(
            horizontalStepperConnectorItemClass,
            horizontalStepperConnectorDisplayClass(compact),
          )}
        >
          {connector}
        </li>
      )}
      <li
        ref={itemRef}
        aria-current={isActive ? "step" : undefined}
        data-status={status}
        className={cn(
          horizontalStepperStepVariants({ variant }),
          // Both compact branches are written out in full here and on the label below.
          // Tailwind scans the built JS for complete class strings (the @source globs in
          // libs/ui/styles/sources.css), so a class assembled by interpolating
          // `@max-xl/horizontal-stepper:` onto a variable ships only the bare prefix and
          // no utility is ever emitted. The trailing space keeps the next step's `[ ]` off
          // the last word of the active label once the connectors are gone.
          isActive && (compact ? "pe-1.5" : "@max-xl/horizontal-stepper:pe-1.5"),
          !isActive && horizontalStepperActiveOnlyCollapseClass,
          Math.abs(distance) > 1 && windowClasses.window,
          className,
        )}
      >
        {hiddenBefore > 0 && (
          <span
            aria-hidden="true"
            className={cn(horizontalStepperElisionClass, windowClasses.elision)}
          >
            +{hiddenBefore}
          </span>
        )}
        {glyph !== null && (
          <span className={horizontalStepperGlyphVariants({ variant, status })}>
            <span className="sr-only">{SR_LABEL[status]}</span>
            {glyph}
          </span>
        )}
        <span
          className={cn(
            horizontalStepperLabelVariants({ variant, status }),
            // `sr-only` rather than `hidden`: the collapsed label leaves the layout but stays
            // in the accessibility tree, so every step is still announced.
            !isActive && (compact ? "sr-only" : "@max-xl/horizontal-stepper:sr-only"),
          )}
        >
          {glyph === null && <span className="sr-only">{SR_LABEL[status]}</span>}
          {isActive && (
            // Position is already conveyed by the list and aria-current; this prefix is the
            // visual stand-in for the labels the compact treatment hides.
            <span
              aria-hidden="true"
              className={cn(
                horizontalStepperCounterClass,
                horizontalStepperCounterVisibilityClass(compact),
              )}
            >
              Step {index + 1}/{total} ·
            </span>
          )}
          {children}
        </span>
        {hiddenAfter > 0 && (
          <span
            aria-hidden="true"
            className={cn(horizontalStepperElisionClass, windowClasses.elision)}
          >
            +{hiddenAfter}
          </span>
        )}
      </li>
    </>
  );
}

function renderConnector(variant: HorizontalStepperVariant, isCompleted: boolean): ReactNode {
  if (variant === "ascii") {
    return (
      <span
        className={cn(
          horizontalStepperConnectorClass,
          isCompleted && horizontalStepperCompletedConnectorClass,
        )}
      >
        ───
      </span>
    );
  }
  if (variant === "breadcrumb") {
    return <span className={horizontalStepperBreadcrumbSeparatorClass}>/</span>;
  }
  // Numbered draws its connector as a ::before segment on the step itself.
  return null;
}

function renderGlyph(variant: HorizontalStepperVariant, status: HorizontalStepStatus): ReactNode {
  if (variant === "numbered") {
    if (status === "completed") return "✓";
    return <span data-counter aria-hidden="true" />;
  }
  if (variant === "breadcrumb" && status === "pending") return null;
  // Same glyph grammar as the form controls: dim brackets, bold mark. The breadcrumb `✓` and `›`
  // are unbracketed and pass through untouched.
  return renderSelectableGlyph(HORIZONTAL_STEP_INDICATOR_GLYPHS[variant][status]);
}
