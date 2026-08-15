"use client";

import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { HorizontalStepperContext } from "./horizontal-stepper-context";
import { HorizontalStepperStep, type HorizontalStepperStepProps } from "./horizontal-stepper-step";
import {
  type HorizontalStepperVariant,
  horizontalStepperRootVariants,
} from "./horizontal-stepper-variants";

type NoInfer<T> = [T][T extends unknown ? 0 : never];

/** Props for horizontal stepper. */
export interface HorizontalStepperProps<TStep extends string = string>
  extends Omit<ComponentProps<"ol">, "children"> {
  /** Id of the active step. */
  value: NoInfer<TStep>;
  /** Visual variant. Drives the indicator glyph, connector treatment, and label typography. */
  variant?: HorizontalStepperVariant;
  /**
   * Forces the compact treatment: connectors drop out, only the active step keeps a visible label,
   * and that label is prefixed with "Step 3/6 ·". When false (default) the stepper switches to the
   * same treatment on its own once its container is narrower than 36rem.
   *
   * Compact has a second tier that stays on the container query either way: below 20rem the glyph
   * run is dropped too and only the "Step 3/6 · Label" text remains.
   */
  compact?: boolean;
  /** HorizontalStepper.Step children in the order they should render. */
  children: ReactNode;
}

const DOCUMENT_POSITION_FOLLOWING = 4;

// SSR/first-render seed before the registration effects run: descend through anything that is
// not a Step, since steps are commonly grouped inside plain wrapper elements.
function collectStepSeed(children: ReactNode): readonly string[] {
  const steps: string[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;

    if (child.type === HorizontalStepperStep) {
      steps.push((child.props as HorizontalStepperStepProps).value);
      return;
    }

    steps.push(...collectStepSeed(child.props.children));
  });

  return steps;
}

function isSameRun(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((step, index) => step === b[index]);
}

/**
 * Seed/live step run. The static child scan only sees elements the caller literally created, so
 * mounted steps take over as the authority once they register and a run assembled inside a
 * consumer component still reports its real order and length.
 */
function useStepRun(seed: readonly string[]) {
  const [mounted, setMounted] = useState<readonly string[]>([]);
  const mountedStepsRef = useRef(new Map<HTMLElement, string>());

  // Document order is read here rather than inside the updater: setState updaters must stay
  // pure under StrictMode replay.
  const commit = useCallback(() => {
    const next = [...mountedStepsRef.current]
      .sort(([a], [b]) => (a.compareDocumentPosition(b) & DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map(([, step]) => step);
    setMounted((current) => (isSameRun(current, next) ? current : next));
  }, []);

  const registerStep = useCallback(
    (step: string, element: HTMLElement) => {
      mountedStepsRef.current.set(element, step);
      commit();
      return () => {
        mountedStepsRef.current.delete(element);
        commit();
      };
    },
    [commit],
  );

  return { steps: mounted.length > 0 ? mounted : seed, registerStep };
}

function assertActiveStep(steps: readonly string[], value: string): void {
  // An empty run means the scan found nothing and no step has registered yet, so there is
  // nothing to judge the active value against until the mounted steps arrive.
  if (steps.length === 0 || steps.includes(value)) return;
  throw new Error(
    `HorizontalStepper: value "${value}" is not present in rendered step children [${steps.join(", ")}]`,
  );
}

/** Sibling primitive: compact horizontal step bar. */
export function HorizontalStepperRoot<TStep extends string>({
  value,
  variant = "ascii",
  compact = false,
  children,
  className,
  "aria-label": ariaLabel,
  ...props
}: HorizontalStepperProps<TStep>) {
  const seed = useMemo(() => collectStepSeed(children), [children]);
  const { steps, registerStep } = useStepRun(seed);
  assertActiveStep(steps, value);

  const contextValue = useMemo(
    () => ({ value, steps, variant, compact, registerStep }),
    [value, steps, variant, compact, registerStep],
  );

  return (
    <HorizontalStepperContext value={contextValue}>
      {/* biome-ignore lint/a11y/useSemanticElements: this already is an <ol>; the explicit role="list" below restores list semantics that Tailwind preflight strips, and Biome should not suggest swapping the element. */}
      <ol
        {...props}
        // biome-ignore lint/a11y/noRedundantRoles: Tailwind preflight sets list-style:none on <ol>, which drops list semantics in Safari/VoiceOver; role="list" restores them.
        role="list"
        aria-label={ariaLabel || "Progress"}
        data-slot="horizontal-stepper"
        data-variant={variant}
        className={cn(horizontalStepperRootVariants({ variant }), className)}
      >
        {children}
      </ol>
    </HorizontalStepperContext>
  );
}
