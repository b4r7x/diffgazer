/**
 * @vitest-environment jsdom
 */

import { FooterProvider } from "@diffgazer/core/footer";
import { getInitialWizardData, type OnboardingStep } from "@diffgazer/core/onboarding";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { FooterView } from "@/testing/footer-view";
import { useOnboardingKeyboard } from "./use-keyboard";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

function KeyboardHarness({
  currentStep = "authentication",
  canProceed = true,
  isFirstStep = false,
}: {
  currentStep?: OnboardingStep;
  canProceed?: boolean;
  isFirstStep?: boolean;
}) {
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const wizardData = getInitialWizardData("gemini");
  const { footer } = useOnboardingKeyboard({
    currentStep,
    wizardData,
    stepIndex: 2,
    isFirstStep,
    isLastStep: currentStep === "acknowledgement",
    canProceed,
    isSubmitting: false,
    isReconciling: false,
    isPreparingDraftConfiguration: false,
    next: vi.fn(),
    back: vi.fn(),
    complete: vi.fn(async () => true),
    focusFallbackRef,
  });

  return (
    <div ref={focusFallbackRef} tabIndex={-1}>
      <input aria-label="Credential field" />
      {!isFirstStep ? (
        <button type="button" {...footer.getActionProps(0)}>
          Back
        </button>
      ) : null}
      <button type="button" {...footer.getActionProps(isFirstStep ? 0 : 1)}>
        Next
      </button>
    </div>
  );
}

function renderHarness(options?: {
  currentStep?: OnboardingStep;
  canProceed?: boolean;
  isFirstStep?: boolean;
}) {
  return render(
    <FooterProvider>
      <KeyboardProvider>
        <KeyboardHarness {...options} />
        <FooterView />
      </KeyboardProvider>
    </FooterProvider>,
  );
}

describe("useOnboardingKeyboard", () => {
  it("moves ArrowDown from an input field into the footer actions without hijacking horizontal arrows", async () => {
    const user = userEvent.setup();
    renderHarness({ isFirstStep: true, canProceed: true });

    const input = screen.getByLabelText("Credential field");
    const next = screen.getByRole("button", { name: "Next" });

    input.focus();
    expect(input).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(next).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(next).toHaveFocus();
  });

  it("advertises no navigation hint on the single-checkbox consent step", () => {
    renderHarness({ currentStep: "acknowledgement", canProceed: false });

    expect(screen.getByText("Accept Consent")).toBeInTheDocument();
    expect(screen.getByText("Focus Actions")).toBeInTheDocument();
    expect(screen.queryByText("Navigate")).not.toBeInTheDocument();
    expect(screen.queryByText("Continue")).not.toBeInTheDocument();
  });

  it("keeps the navigation hint on steps with options to navigate", () => {
    renderHarness({ currentStep: "authentication" });

    expect(screen.getByText("Navigate Fields")).toBeInTheDocument();
  });

  it("advertises the consent Enter hint only once the step can proceed", () => {
    renderHarness({ currentStep: "acknowledgement", canProceed: true });

    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("advertises the quit key that stays live through setup", () => {
    renderHarness();

    expect(screen.getByText("Quit")).toBeInTheDocument();
    expect(screen.getByText("q")).toBeInTheDocument();
  });
});
