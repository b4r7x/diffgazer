import type { InputMethod } from "@diffgazer/core/onboarding";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ApiKeyFocusTarget } from "@/types/api-key-focus-target";
import { ApiKeyMethodSelector } from "./method-selector";

function Subject({
  onFocusChange = vi.fn(),
  envVarName,
  methodOptionElements = new Map(),
}: {
  onFocusChange?: (value: ApiKeyFocusTarget) => void;
  envVarName?: string;
  /** Mirrors the dialog's roving-focus ref registry, which is always supplied. */
  methodOptionElements?: Map<InputMethod, HTMLDivElement | null>;
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
      getMethodOptionProps={(optionMethod) => ({
        ref: (element) => {
          methodOptionElements.set(optionMethod, element);
        },
      })}
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

    const input = screen.getByLabelText("Gemini API Key");
    expect(input).toHaveFocus();
    // The pasted key must not become a browser-stored, cloud-synced credential.
    expect(input).toHaveAttribute("autocomplete", "off");
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

  it("registers both method rows with the caller's roving-focus refs", () => {
    const methodOptionElements = new Map<InputMethod, HTMLDivElement | null>();

    render(<Subject methodOptionElements={methodOptionElements} />);

    expect(methodOptionElements.get("paste")).toBe(
      screen.getByRole("radio", { name: "Paste Key Now" }),
    );
    expect(methodOptionElements.get("env")).toBe(
      screen.getByRole("radio", { name: "Import from Env" }),
    );
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
