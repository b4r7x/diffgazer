import type { InputMethod } from "@diffgazer/core/onboarding";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyStep } from "./api-key-step";

function ControlledApiKeyStep({
  onCommit,
}: {
  onCommit: (nextValue: { inputMethod: InputMethod; apiKey: string }) => void;
}) {
  const [method, setMethod] = useState<InputMethod>("paste");
  const [keyValue, setKeyValue] = useState("");

  return (
    <ApiKeyStep
      provider="gemini"
      value={method}
      onChange={setMethod}
      keyValue={keyValue}
      onKeyValueChange={setKeyValue}
      onCommit={onCommit}
    />
  );
}

describe("ApiKeyStep", () => {
  it("moves DOM focus from the key input to both method options", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <ApiKeyStep
          provider="gemini"
          value="paste"
          onChange={vi.fn()}
          keyValue=""
          onKeyValueChange={vi.fn()}
        />
      </KeyboardProvider>,
    );

    const input = screen.getByLabelText("Google Gemini API Key");
    const paste = screen.getByRole("radio", { name: "Paste Key Now" });
    const env = screen.getByRole("radio", { name: "Import from Env" });

    await user.click(input);
    await user.keyboard("{ArrowDown}");
    expect(env).toHaveFocus();

    await user.click(input);
    await user.keyboard("{ArrowUp}");
    expect(paste).toHaveFocus();
  });

  it("selects and commits the focused method through the real selector", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCommit = vi.fn();

    render(
      <KeyboardProvider>
        <ApiKeyStep
          provider="gemini"
          value="paste"
          onChange={onChange}
          keyValue=""
          onKeyValueChange={vi.fn()}
          onCommit={onCommit}
        />
      </KeyboardProvider>,
    );

    const env = screen.getByRole("radio", { name: "Import from Env" });
    env.focus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("env");
    expect(onCommit).toHaveBeenCalledWith({ inputMethod: "env", apiKey: "" });
  });

  it("commits the typed secret when Enter is pressed in the key input", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <KeyboardProvider>
        <ControlledApiKeyStep onCommit={onCommit} />
      </KeyboardProvider>,
    );

    const input = screen.getByLabelText("Google Gemini API Key");
    await user.type(input, "sk-live-secret");
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith({ inputMethod: "paste", apiKey: "sk-live-secret" });
  });

  it("reports the boundary once when ArrowDown is pressed from the env option", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(
      <KeyboardProvider>
        <ApiKeyStep
          provider="gemini"
          value="paste"
          onChange={vi.fn()}
          keyValue=""
          onKeyValueChange={vi.fn()}
          onBoundaryReached={onBoundaryReached}
        />
      </KeyboardProvider>,
    );

    const env = screen.getByRole("radio", { name: "Import from Env" });
    env.focus();
    await user.keyboard("{ArrowDown}");

    expect(onBoundaryReached).toHaveBeenCalledWith("down");
    expect(onBoundaryReached).toHaveBeenCalledTimes(1);
  });
});
