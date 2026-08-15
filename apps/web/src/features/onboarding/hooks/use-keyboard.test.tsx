/**
 * @vitest-environment jsdom
 */

import { FooterProvider } from "@diffgazer/core/footer";
import { getInitialWizardData } from "@diffgazer/core/onboarding";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useOnboardingKeyboard } from "./use-keyboard";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

function KeyboardHarness({
  canProceed = true,
  isFirstStep = false,
}: {
  canProceed?: boolean;
  isFirstStep?: boolean;
}) {
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const wizardData = getInitialWizardData("gemini");
  const { footer } = useOnboardingKeyboard({
    currentStep: "authentication",
    wizardData,
    stepIndex: 2,
    isFirstStep,
    isLastStep: false,
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

function renderHarness(options?: { canProceed?: boolean; isFirstStep?: boolean }) {
  return render(
    <FooterProvider>
      <KeyboardProvider>
        <KeyboardHarness {...options} />
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
});
