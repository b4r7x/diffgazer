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
  const { focused, getMethodOptionProps } = useApiKeyDialogKeyboard({
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
      <button type="button" data-testid="paste" {...getMethodOptionProps("paste")}>
        Paste
      </button>
      <input ref={inputRef} data-testid="input" />
      <button type="button" data-testid="env" {...getMethodOptionProps("env")}>
        Env
      </button>
      <span data-testid="focused">{focused}</span>
      <span data-testid="method">{method}</span>
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

    await waitFor(() => expect(screen.getByTestId("paste")).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("input")).toHaveFocus();
    expect(screen.getByTestId("focused")).toHaveTextContent("input");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("env")).toHaveFocus();
    expect(screen.getByTestId("focused")).toHaveTextContent("env");

    await user.keyboard("{Enter}");
    expect(screen.getByTestId("method")).toHaveTextContent("env");
    expect(onSubmit).toHaveBeenCalledWith("env");
  });
});
