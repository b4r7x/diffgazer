import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import { useRef, useState } from "react";
import type { InputMethod } from "@/types/input-method";
import { useApiKeyDialogKeyboard } from "./use-api-key-dialog-keyboard";

function Subject({ onSubmit = vi.fn() }: { onSubmit?: (method?: InputMethod) => void }) {
  const [method, setMethod] = useState<InputMethod>("paste");
  const inputRef = useRef<HTMLInputElement>(null);
  const { getMethodOptionProps } = useApiKeyDialogKeyboard({
    open: true,
    method,
    setMethod,
    canSubmit: false,
    inputRef,
    onSubmit,
    onClose: vi.fn(),
  });

  return (
    <>
      <div role="radio" aria-checked={method === "paste"} tabIndex={0} {...getMethodOptionProps("paste")}>
        Paste
      </div>
      <input ref={inputRef} aria-label="API key" />
      <div role="radio" aria-checked={method === "env"} tabIndex={0} {...getMethodOptionProps("env")}>
        Env
      </div>
    </>
  );
}

describe("useApiKeyDialogKeyboard", () => {
  it("moves real focus through method options and submits the focused env method", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <KeyboardProvider>
        <Subject onSubmit={onSubmit} />
      </KeyboardProvider>,
    );

    const paste = screen.getByRole("radio", { name: "Paste" });
    const input = screen.getByRole("textbox", { name: "API key" });
    const env = screen.getByRole("radio", { name: "Env" });

    await waitFor(() => expect(paste).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(env).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(env).toHaveAttribute("aria-checked", "true");
    expect(onSubmit).toHaveBeenCalledWith("env");
  });
});
