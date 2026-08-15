import { describe, expectTypeOf, it } from "vitest";
import type { HorizontalStepperProps } from "./horizontal-stepper";
import type { HorizontalStepperStepProps } from "./horizontal-stepper-step";

const stepValues = ["init", "scan", "analyze", "report"] as const;
type ProgressSteps = (typeof stepValues)[number];

describe("HorizontalStepper types", () => {
  it("narrows value to the supplied literal step union", () => {
    type Narrow = HorizontalStepperProps<ProgressSteps>;

    expectTypeOf<Narrow["value"]>().toEqualTypeOf<ProgressSteps>();
  });

  it("rejects active ids outside the literal step tuple", () => {
    expectTypeOf<"init">().toMatchTypeOf<HorizontalStepperProps<ProgressSteps>["value"]>();
    expectTypeOf<"typo">().not.toMatchTypeOf<HorizontalStepperProps<ProgressSteps>["value"]>();
  });

  it("keeps the loose default contract when no generic is supplied", () => {
    expectTypeOf<HorizontalStepperProps["value"]>().toEqualTypeOf<string>();
    expectTypeOf<HorizontalStepperStepProps["value"]>().toEqualTypeOf<string>();
  });
});
