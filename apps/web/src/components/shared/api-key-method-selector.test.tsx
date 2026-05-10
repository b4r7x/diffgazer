import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiKeyMethodSelector } from "./api-key-method-selector";
import type { FocusElement } from "@/types/focus-element";
import type { InputMethod } from "@/types/input-method";

function Subject() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState<InputMethod>("paste");
  const [focused, setFocused] = useState<FocusElement>("paste");

  return (
    <ApiKeyMethodSelector
      method={method}
      onMethodChange={setMethod}
      keyValue=""
      onKeyValueChange={vi.fn()}
      envVarName="GEMINI_API_KEY"
      providerName="Gemini"
      inputRef={inputRef}
      focused={focused}
      onFocus={setFocused}
      onKeySubmit={vi.fn()}
      onMethodKeyDown={(event, focusedMethod) => {
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
  it("keeps one tabbable method radio and preserves input handoff", async () => {
    const user = userEvent.setup();

    render(<Subject />);

    const paste = screen.getByRole("radio", { name: "Paste Key Now" });
    const env = screen.getByRole("radio", { name: "Import from Env" });

    expect([paste, env].map((radio) => radio.getAttribute("tabindex"))).toEqual(["0", "-1"]);

    paste.focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByLabelText("Gemini API Key")).toHaveFocus();
  });
});
