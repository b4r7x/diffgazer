import type { InputMethod } from "@diffgazer/core/onboarding";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyMethodSelector } from "./method-selector";
import { useApiKeyDialogKeyboard } from "./use-keyboard";

function Subject({
  onSubmit = vi.fn(),
  onClose = vi.fn(),
  canSubmit = false,
  isSubmitting = false,
  isHosted = true,
}: {
  onSubmit?: () => void;
  onClose?: () => void;
  canSubmit?: boolean;
  isSubmitting?: boolean;
  isHosted?: boolean;
}) {
  const [method, setMethod] = useState<InputMethod>("paste");
  const inputRef = useRef<HTMLInputElement>(null);
  const acknowledgementRef = useRef<HTMLElement>(null);
  const {
    focused,
    setFocused,
    getMethodOptionProps,
    getCancelProps,
    getConfirmProps,
    getAcknowledgementProps,
    handleMethodKeyDown,
    handleMethodCommit,
  } = useApiKeyDialogKeyboard({
    open: true,
    isHosted,
    method,
    setMethod,
    canSubmit,
    isSubmitting,
    inputRef,
    acknowledgementRef,
    onSubmit,
    onClose,
  });
  const cancelProps = getCancelProps();
  const confirmProps = getConfirmProps();
  const acknowledgementProps = getAcknowledgementProps();

  return (
    <>
      {isHosted ? (
        <ApiKeyMethodSelector
          value={method}
          onChange={setMethod}
          keyValue=""
          onKeyValueChange={vi.fn()}
          providerName="Gemini"
          inputRef={inputRef}
          focused={focused}
          onFocus={setFocused}
          onKeySubmit={onSubmit}
          onMethodCommit={handleMethodCommit}
          onInputMethodKeyDown={handleMethodKeyDown}
          getMethodOptionProps={getMethodOptionProps}
        />
      ) : null}
      <button type="button" ref={acknowledgementProps.ref} onFocus={acknowledgementProps.onFocus}>
        Accept notice
      </button>
      <button ref={cancelProps.ref} type="button" onFocus={cancelProps.onFocus} onClick={onClose}>
        Cancel
      </button>
      <button
        ref={confirmProps.ref}
        type="button"
        disabled={!canSubmit}
        onFocus={confirmProps.onFocus}
        onClick={onSubmit}
      >
        Save
      </button>
    </>
  );
}

describe("useApiKeyDialogKeyboard hosted flow", () => {
  it("moves real focus through method options and submits the focused env method", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <KeyboardProvider>
        <Subject onSubmit={onSubmit} canSubmit />
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
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("does not submit the env method while a submit is already in flight", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <KeyboardProvider>
        <Subject onSubmit={onSubmit} isSubmitting canSubmit />
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

  it("keeps footer keyboard focus on cancel when save is disabled", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(
      <KeyboardProvider>
        <Subject onClose={onClose} onSubmit={onSubmit} canSubmit={false} />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: "Paste Key Now" })).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const save = screen.getByRole("button", { name: "Save" });
    expect(cancel).toHaveFocus();
    expect(save).toBeDisabled();

    await user.keyboard("{ArrowRight}{Enter}");

    expect(cancel).toHaveFocus();
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reverses focus back through footer, acknowledgement, radios, and input on repeated ArrowUp", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <Subject canSubmit />
      </KeyboardProvider>,
    );

    const paste = screen.getByRole("radio", { name: "Paste Key Now" });
    const input = screen.getByLabelText("Gemini API Key");
    const env = screen.getByRole("radio", { name: "Import from Env" });
    const acknowledgement = screen.getByRole("button", { name: "Accept notice" });
    const _cancel = screen.getByRole("button", { name: "Cancel" });

    await waitFor(() => expect(paste).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(env).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(acknowledgement).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(acknowledgement).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(env).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(paste).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(paste).toHaveFocus();
  });

  it("repairs footer focus when save becomes disabled while focused", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <KeyboardProvider>
        <Subject onClose={onClose} onSubmit={onSubmit} canSubmit />
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: "Paste Key Now" })).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}");

    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();

    rerender(
      <KeyboardProvider>
        <Subject onClose={onClose} onSubmit={onSubmit} canSubmit={false} />
      </KeyboardProvider>,
    );

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const save = screen.getByRole("button", { name: "Save" });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(save).toBeDisabled();

    await user.keyboard("{Enter}");

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("useApiKeyDialogKeyboard local setup", () => {
  it("starts on acknowledgement and reaches save without credential controls", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <KeyboardProvider>
        <Subject onSubmit={onSubmit} canSubmit isHosted={false} />
      </KeyboardProvider>,
    );

    const acknowledgement = screen.getByRole("button", { name: "Accept notice" });
    await waitFor(() => expect(acknowledgement).toHaveFocus());

    expect(screen.queryByRole("radio", { name: "Paste Key Now" })).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });
});
