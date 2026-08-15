import { describe, expect, it } from "vitest";
import * as onboarding from "./index.js";

// `./index.js` is the module the `@diffgazer/core/onboarding` subpath resolves
// to, so this is the surface a consumer can actually reach.
describe("@diffgazer/core/onboarding entry", () => {
  it("carries no fixed API-key wizard exports from the pre-V2 onboarding flow", () => {
    expect("INPUT_METHODS" in onboarding).toBe(false);
    expect("isInputMethod" in onboarding).toBe(false);
    expect("WIZARD_STEPS" in onboarding).toBe(false);
  });

  it("exposes the dynamic setup-plan state contracts", () => {
    expect(onboarding).toMatchObject({
      OnboardingStateSchema: expect.anything(),
      buildSetupPlan: expect.any(Function),
      canProceed: expect.any(Function),
      getInitialWizardData: expect.any(Function),
      useWizardState: expect.any(Function),
    });
  });
});
