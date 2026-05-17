import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import { useRef, useState } from "react";
import type { InputMethod } from "@/types/input-method";
import { useApiKeyDialogKeyboard } from "./use-api-key-dialog-keyboard";

function Subject({
  onSubmit = vi.fn(),
  onClose = vi.fn(),
  canSubmit = false,
  isSubmitting = false,
}: {
  onSubmit?: (method?: InputMethod) => void;
  onClose?: () => void;
  canSubmit?: boolean;
  isSubmitting?: boolean;
}) {
  const [method, setMethod] = useState<InputMethod>("paste");
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    getMethodOptionProps,
    getCancelProps,
    getConfirmProps,
  } = useApiKeyDialogKeyboard({
    open: true,
    method,
    setMethod,
    canSubmit,
    isSubmitting,
    inputRef,
    onSubmit,
    onClose,
  });
  const cancelProps = getCancelProps();
  const confirmProps = getConfirmProps();

  return (
    <>
      <div role="radio" aria-checked={method === "paste"} tabIndex={0} {...getMethodOptionProps("paste")}>
        Paste
      </div>
      <input ref={inputRef} aria-label="API key" />
      <div role="radio" aria-checked={method === "env"} tabIndex={0} {...getMethodOptionProps("env")}>
        Env
      </div>
      <button
        ref={cancelProps.ref}
        type="button"
        onFocus={cancelProps.onFocus}
        onClick={onClose}
      >
        Cancel
      </button>
      <button
        ref={confirmProps.ref}
        type="button"
        disabled={!canSubmit}
        onFocus={confirmProps.onFocus}
        onClick={() => onSubmit()}
      >
        Confirm
      </button>
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

  it("does not submit the env method while a submit is already in flight", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <KeyboardProvider>
        <Subject onSubmit={onSubmit} isSubmitting />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: "Paste" })).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(screen.getByRole("radio", { name: "Env" })).toHaveAttribute("aria-checked", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps footer keyboard focus on cancel when confirm is disabled", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(
      <KeyboardProvider>
        <Subject onClose={onClose} onSubmit={onSubmit} canSubmit={false} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: "Paste" })).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(cancel).toHaveFocus();
    expect(confirm).toBeDisabled();

    await user.keyboard("{ArrowRight}{Enter}");

    expect(cancel).toHaveFocus();
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("repairs footer focus when confirm becomes disabled while focused", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <KeyboardProvider>
        <Subject onClose={onClose} onSubmit={onSubmit} canSubmit />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: "Paste" })).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}");

    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();

    rerender(
      <KeyboardProvider>
        <Subject onClose={onClose} onSubmit={onSubmit} canSubmit={false} />
      </KeyboardProvider>,
    );

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(confirm).toBeDisabled();

    await user.keyboard("{Enter}");

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
