import { getInitialWizardData } from "@diffgazer/core/onboarding";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyStep } from "./api-key-step";

describe("ApiKeyStep", () => {
  it("collects a write-only hosted credential without exposing env-var names", async () => {
    const user = userEvent.setup();
    const hosted = getInitialWizardData("gemini");

    function ControlledStep() {
      const [configurationInput, setConfigurationInput] = useState(hosted.configurationInput);
      return (
        <KeyboardProvider>
          <ApiKeyStep configurationInput={configurationInput} onChange={setConfigurationInput} />
        </KeyboardProvider>
      );
    }

    render(<ControlledStep />);

    const input = screen.getByLabelText("Google Gemini credential");
    await user.type(input, "sk-live-secret");
    expect(input).toHaveValue("sk-live-secret");
    expect(input).toHaveFocus();
    expect(screen.queryByText(/GOOGLE_API_KEY/i)).not.toBeInTheDocument();
    // The typed key must not become a browser-stored, cloud-synced credential.
    expect(input).toHaveAttribute("autocomplete", "off");
  });

  it("commits environment references without retaining a typed secret", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const hosted = getInitialWizardData("gemini");

    function ControlledStep() {
      const [configurationInput, setConfigurationInput] = useState(hosted.configurationInput);
      return (
        <KeyboardProvider>
          <ApiKeyStep
            configurationInput={configurationInput}
            onChange={setConfigurationInput}
            onCommit={onCommit}
          />
        </KeyboardProvider>
      );
    }

    render(<ControlledStep />);
    await user.click(screen.getByRole("radio", { name: "Use environment reference" }));
    await user.keyboard("{Enter}");
    expect(onCommit).toHaveBeenCalled();
    expect(screen.queryByDisplayValue("sk-")).not.toBeInTheDocument();
  });

  it("focuses the selected method when the step becomes active", () => {
    const hosted = getInitialWizardData("gemini");

    render(
      <KeyboardProvider>
        <ApiKeyStep configurationInput={hosted.configurationInput} onChange={vi.fn()} />
      </KeyboardProvider>,
    );

    expect(screen.getByRole("radio", { name: "Enter credential now" })).toHaveFocus();
  });

  it("moves DOM focus with the visible highlight through the credential zone", async () => {
    const user = userEvent.setup();
    const hosted = getInitialWizardData("gemini");

    function ControlledStep() {
      const [configurationInput, setConfigurationInput] = useState(hosted.configurationInput);
      return (
        <KeyboardProvider>
          <ApiKeyStep configurationInput={configurationInput} onChange={setConfigurationInput} />
        </KeyboardProvider>
      );
    }

    render(<ControlledStep />);

    const literal = screen.getByRole("radio", { name: "Enter credential now" });
    const environment = screen.getByRole("radio", { name: "Use environment reference" });
    const credential = screen.getByLabelText("Google Gemini credential");

    literal.focus();
    await user.keyboard("{ArrowDown}");
    expect(credential).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(environment).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(credential).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(literal).toHaveFocus();

    // The j/k vim aliases move through the same zone as the vertical arrows.
    await user.keyboard("j");
    expect(credential).toHaveFocus();
  });

  it("passes the environment option on the way down out of the credential input", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();
    const hosted = getInitialWizardData("gemini");

    render(
      <KeyboardProvider>
        <ApiKeyStep
          configurationInput={hosted.configurationInput}
          onChange={vi.fn()}
          onBoundaryReached={onBoundaryReached}
        />
      </KeyboardProvider>,
    );

    screen.getByLabelText("Google Gemini credential").focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: "Use environment reference" })).toHaveFocus();
    expect(onBoundaryReached).not.toHaveBeenCalled();

    await user.keyboard("{ArrowDown}");

    expect(onBoundaryReached).toHaveBeenCalledWith("down");
  });

  it("reports the down boundary from the last credential option instead of trapping focus", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();
    const hosted = getInitialWizardData("gemini");

    render(
      <KeyboardProvider>
        <ApiKeyStep
          configurationInput={{ ...hosted.configurationInput, credential: { kind: "environment" } }}
          onChange={vi.fn()}
          onBoundaryReached={onBoundaryReached}
        />
      </KeyboardProvider>,
    );

    screen.getByRole("radio", { name: "Use environment reference" }).focus();
    await user.keyboard("{ArrowDown}");

    expect(onBoundaryReached).toHaveBeenCalledWith("down");
  });

  it("keeps horizontal arrows in the credential method group from reaching the footer", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();
    const hosted = getInitialWizardData("gemini");

    render(
      <KeyboardProvider>
        <ApiKeyStep
          configurationInput={hosted.configurationInput}
          onChange={vi.fn()}
          onBoundaryReached={onBoundaryReached}
        />
      </KeyboardProvider>,
    );

    const literal = screen.getByRole("radio", { name: "Enter credential now" });
    literal.focus();
    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Use environment reference" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");

    expect(onBoundaryReached).not.toHaveBeenCalled();
  });

  it("shows no credential highlight while the footer owns the step", () => {
    const hosted = getInitialWizardData("gemini");

    render(
      <KeyboardProvider>
        <ApiKeyStep
          configurationInput={hosted.configurationInput}
          onChange={vi.fn()}
          enabled={false}
        />
      </KeyboardProvider>,
    );

    expect(screen.getByRole("radio", { name: "Enter credential now" })).not.toHaveAttribute(
      "data-highlighted",
    );
    expect(screen.getByRole("radio", { name: "Use environment reference" })).not.toHaveAttribute(
      "data-highlighted",
    );
  });
});
