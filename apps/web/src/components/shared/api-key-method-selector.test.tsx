import type { InputMethod } from "@diffgazer/core/onboarding";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ApiKeyFocusTarget } from "@/types/api-key-focus-target";
import { ApiKeyMethodSelector } from "./api-key-method-selector";

function Subject({
  onFocusChange = vi.fn(),
  envVarName,
}: {
  onFocusChange?: (value: ApiKeyFocusTarget) => void;
  envVarName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState<InputMethod>("paste");
  const [focused, setFocused] = useState<ApiKeyFocusTarget>("paste");

  return (
    <ApiKeyMethodSelector
      value={method}
      onChange={setMethod}
      keyValue=""
      onKeyValueChange={vi.fn()}
      envVarName={envVarName}
      providerName="Gemini"
      inputRef={inputRef}
      focused={focused}
      onFocus={(nextFocused) => {
        onFocusChange(nextFocused);
        setFocused(nextFocused);
      }}
      onKeySubmit={vi.fn()}
      onMethodCommit={vi.fn()}
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

describe("ApiKeyMethodSelector hosted-only secret methods", () => {
  it("preserves input handoff from the paste method", async () => {
    const user = userEvent.setup();

    render(<Subject />);

    const paste = screen.getByRole("radio", { name: "Paste Key Now" });

    paste.focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByLabelText("Gemini API Key")).toHaveFocus();
  });

  // aria-checked is what the selected-row presentation hangs off, so the state moving
  // between rows is the contract; the fill, accent bar, and accent glyph follow it.
  it("marks exactly one method row as the selected option", async () => {
    const user = userEvent.setup();

    render(<Subject />);

    const paste = screen.getByRole("radio", { name: "Paste Key Now" });
    const env = screen.getByRole("radio", { name: "Import from Env" });
    expect(paste).toHaveAttribute("aria-checked", "true");
    expect(env).toHaveAttribute("aria-checked", "false");

    await user.click(env);

    expect(env).toHaveAttribute("aria-checked", "true");
    expect(paste).toHaveAttribute("aria-checked", "false");
  });

  it("previews the $ENV variable name the env method binds", () => {
    render(<Subject envVarName="GOOGLE_API_KEY" />);

    expect(
      screen.getByRole("textbox", { name: "GOOGLE_API_KEY environment variable" }),
    ).toHaveValue("GOOGLE_API_KEY");
    expect(screen.queryByText(/configured environment variable binding/i)).not.toBeInTheDocument();
  });

  it("describes environment import without requiring a typed env var name", () => {
    render(<Subject />);

    expect(screen.getByText(/configured environment variable binding/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /environment variable/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps Env focused when disabled paste padding is clicked", async () => {
    const user = userEvent.setup();
    const onFocusChange = vi.fn();

    render(<Subject onFocusChange={onFocusChange} />);

    const env = screen.getByRole("radio", { name: "Import from Env" });
    await user.click(env);
    expect(env).toHaveFocus();
    expect(env).toBeChecked();

    const input = screen.getByLabelText("Gemini API Key");
    const pastePadding = input.closest('[data-slot="input-group"]')?.parentElement;
    if (!pastePadding) throw new Error("Expected paste padding wrapper");
    onFocusChange.mockClear();

    await user.click(pastePadding);

    expect(env).toHaveFocus();
    expect(env).toBeChecked();
    expect(onFocusChange).not.toHaveBeenCalled();
  });
});
