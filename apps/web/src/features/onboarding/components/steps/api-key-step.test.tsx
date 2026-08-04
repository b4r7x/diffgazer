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
    if (hosted.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted configuration");
    }

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
  });

  it("does not render hosted credential controls for local HTTP setup", () => {
    const local = getInitialWizardData("local-openai");
    render(<ApiKeyStep configurationInput={local.configurationInput} onChange={vi.fn()} />);

    expect(screen.getByText(/without storing hosted credentials/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/credential/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });

  it("does not render hosted credential controls for local CLI setup", () => {
    const localCli = getInitialWizardData("codex-cli");
    render(<ApiKeyStep configurationInput={localCli.configurationInput} onChange={vi.fn()} />);

    expect(screen.getByText(/without storing hosted credentials/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/credential/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/OpenAI Codex CLI installation ID/i)).toBeInTheDocument();
  });

  it("focuses the bearer checkbox when the local HTTP step becomes active", () => {
    const local = getInitialWizardData("local-openai");
    render(<ApiKeyStep configurationInput={local.configurationInput} onChange={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: /bearer token/i })).toHaveFocus();
  });

  it("focuses the installation input when the local CLI step becomes active", () => {
    const localCli = getInitialWizardData("codex-cli");
    render(<ApiKeyStep configurationInput={localCli.configurationInput} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/OpenAI Codex CLI installation ID/i)).toHaveFocus();
  });

  it("commits environment references without retaining a typed secret", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const hosted = getInitialWizardData("gemini");
    if (hosted.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted configuration");
    }

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
    if (hosted.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted configuration");
    }

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
    if (hosted.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted configuration");
    }

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

  it("reports the down boundary from the last credential option instead of trapping focus", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();
    const hosted = getInitialWizardData("gemini");
    if (hosted.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted configuration");
    }

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

  it("offers the optional local bearer the setup plan advertises", async () => {
    const user = userEvent.setup();
    const local = getInitialWizardData("local-openai");
    if (local.configurationInput.transportFamily !== "local-http") {
      throw new Error("Expected local HTTP configuration");
    }

    function ControlledStep() {
      const [configurationInput, setConfigurationInput] = useState(local.configurationInput);
      return (
        <KeyboardProvider>
          <ApiKeyStep configurationInput={configurationInput} onChange={setConfigurationInput} />
        </KeyboardProvider>
      );
    }

    render(<ControlledStep />);

    expect(screen.queryByLabelText("Local bearer token")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /bearer token/i }));

    const token = screen.getByLabelText("Local bearer token");
    await user.type(token, "local-secret");
    expect(token).toHaveValue("local-secret");
  });
});
