import type { InputMethod } from "@diffgazer/core/onboarding";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyMethodSelector } from "@/components/shared/api-key-method-selector";
import { useApiKeyDialogKeyboard } from "./use-keyboard";

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
    focused,
    setFocused,
    getMethodOptionProps,
    getCancelProps,
    getConfirmProps,
    handleMethodKeyDown,
    handleMethodCommit,
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
        onKeySubmit={() => onSubmit(method)}
        onMethodCommit={handleMethodCommit}
        onInputMethodKeyDown={handleMethodKeyDown}
        getMethodOptionProps={getMethodOptionProps}
      />
      <button ref={cancelProps.ref} type="button" onFocus={cancelProps.onFocus} onClick={onClose}>
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

    const paste = screen.getByRole("radio", { name: "Paste Key Now" });
    const input = screen.getByLabelText("Gemini API Key");
    const env = screen.getByRole("radio", { name: "Import from Env" });

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

    await waitFor(() => expect(screen.getByRole("radio", { name: "Paste Key Now" })).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(screen.getByRole("radio", { name: "Import from Env" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
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

    await waitFor(() => expect(screen.getByRole("radio", { name: "Paste Key Now" })).toHaveFocus());

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

    await waitFor(() => expect(screen.getByRole("radio", { name: "Paste Key Now" })).toHaveFocus());

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
