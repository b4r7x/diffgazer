import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyStep } from "./api-key-step";

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
});
