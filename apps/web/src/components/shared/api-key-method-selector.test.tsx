import type { InputMethod } from "@diffgazer/core/onboarding";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FocusElement } from "@/types/focus-element";
import { ApiKeyMethodSelector } from "./api-key-method-selector";

function Subject() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState<InputMethod>("paste");
  const [focused, setFocused] = useState<FocusElement>("paste");

  return (
    <ApiKeyMethodSelector
      value={method}
      onChange={setMethod}
      keyValue=""
      onKeyValueChange={vi.fn()}
      envVarName="GEMINI_API_KEY"
      providerName="Gemini"
      inputRef={inputRef}
      focused={focused}
      onFocus={setFocused}
      onKeySubmit={vi.fn()}
      onInputMethodKeyDown={(event, focusedMethod) => {
        if (event.key === "ArrowDown" && focusedMethod === "paste" && method === "paste") {
          event.preventDefault();
          setFocused("input");
          inputRef.current?.focus();
        }
      }}
    />
  );
}

describe("ApiKeyMethodSelector", () => {
  it("preserves input handoff from the paste method", async () => {
    const user = userEvent.setup();

    render(<Subject />);

    const paste = screen.getByRole("radio", { name: "Paste Key Now" });

    paste.focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByLabelText("Gemini API Key")).toHaveFocus();
  });

  it("renders the environment variable with the shared input shell", () => {
    render(<Subject />);

    const envInput = screen.getByRole("textbox", {
      name: "GEMINI_API_KEY environment variable",
    });

    expect(envInput).toHaveValue("GEMINI_API_KEY");
    expect(envInput).toHaveAttribute("readonly");
    expect(envInput).toHaveAttribute("tabindex", "-1");
  });
});
