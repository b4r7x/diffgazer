import { FooterProvider, useFooterData, usePageFooter } from "@diffgazer/core/footer";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/layout/footer";
import { ApiKeyDialog, type ApiKeyDialogProps } from "./dialog";

beforeAll(() => {
  if (typeof HTMLDialogElement === "undefined") return;
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute("open");
  };
});

function MountedFooter() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

function ProvidersPageStub({ dialogOpen }: { dialogOpen: boolean }) {
  const [open, setOpen] = useState(dialogOpen);

  usePageFooter(
    open
      ? { shortcuts: [], rightShortcuts: [] }
      : {
          shortcuts: [{ key: "↑/↓", label: "Navigate Providers" }],
          rightShortcuts: [{ key: "Esc", label: "Back" }],
        },
  );

  return (
    <>
      <MountedFooter />
      <ApiKeyDialog
        open={open}
        onOpenChange={setOpen}
        providerName="Z.AI"
        envVarName="ZAI_API_KEY"
        onSubmit={vi.fn().mockResolvedValue(true)}
      />
    </>
  );
}

function renderProvidersStub(dialogOpen: boolean) {
  return render(
    <FooterProvider>
      <KeyboardProvider>
        <ProvidersPageStub dialogOpen={dialogOpen} />
      </KeyboardProvider>
    </FooterProvider>,
  );
}

function DeferredApiKeyDialog({ onSubmit }: Pick<ApiKeyDialogProps, "onSubmit">) {
  const [open, setOpen] = useState(true);

  return (
    <FooterProvider>
      <KeyboardProvider>
        <ApiKeyDialog
          open={open}
          onOpenChange={setOpen}
          providerName="Z.AI"
          envVarName="ZAI_API_KEY"
          onSubmit={onSubmit}
        />
      </KeyboardProvider>
    </FooterProvider>
  );
}

function ReopenableApiKeyDialog({ onSubmit }: Pick<ApiKeyDialogProps, "onSubmit">) {
  const [open, setOpen] = useState(true);

  return (
    <FooterProvider>
      <KeyboardProvider>
        <button type="button" onClick={() => setOpen(true)}>
          Reopen API Key
        </button>
        <ApiKeyDialog
          open={open}
          onOpenChange={setOpen}
          providerName="Z.AI"
          envVarName="ZAI_API_KEY"
          onSubmit={onSubmit}
        />
      </KeyboardProvider>
    </FooterProvider>
  );
}

function mockDialogBounds(dialog: HTMLElement) {
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    x: 100,
    y: 100,
    width: 320,
    height: 240,
    top: 100,
    right: 420,
    bottom: 340,
    left: 100,
    toJSON() {},
  });
}

describe("ApiKeyDialog footer integration", () => {
  it("renders dialog kbd hints with the standardized wording and glyphs while open", () => {
    renderProvidersStub(true);

    const dialog = screen.getByRole("dialog", { name: /API Key/ });

    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeInTheDocument();

    const kbdNodes = within(dialog).getAllByText((_, element) => element?.tagName === "KBD");
    const kbdTexts = kbdNodes.map((node) => node.textContent);
    expect(kbdTexts).toEqual(expect.arrayContaining(["↑/↓", "Enter/Space", "Esc", "Enter"]));

    expect(within(dialog).getByText("Navigate")).toBeInTheDocument();
    expect(within(dialog).getByText("Select")).toBeInTheDocument();
  });

  it("clears the global footer shortcuts while the dialog is open", () => {
    renderProvidersStub(true);

    expect(screen.queryByText("Navigate Providers")).not.toBeInTheDocument();
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  it("restores the global footer shortcuts when the dialog is closed", () => {
    renderProvidersStub(false);

    expect(screen.getByText("Navigate Providers")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("announces a failed save inline and marks the key input invalid without a toast", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Storage not configured"));

    render(
      <FooterProvider>
        <KeyboardProvider>
          <ApiKeyDialog
            open
            onOpenChange={vi.fn()}
            providerName="Z.AI"
            envVarName="ZAI_API_KEY"
            onSubmit={onSubmit}
          />
        </KeyboardProvider>
      </FooterProvider>,
    );

    const dialog = screen.getByRole("dialog", { name: /API Key/ });
    const keyInput = within(dialog).getByLabelText("Z.AI API Key");
    await user.type(keyInput, "sk-test-key");
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    // WCAG 3.3.1/4.1.3: the failure is announced inside the focus-trapped dialog.
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Storage not configured");
    expect(keyInput).toHaveAttribute("aria-invalid", "true");
    expect(keyInput).toHaveAttribute("aria-describedby", alert.id);
    // The dialog owns the report; nothing closes it on failure.
    expect(dialog).toBeInTheDocument();
  });

  it("submits the method committed with Enter on the real selector", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<ApiKeyDialogProps["onSubmit"]>().mockResolvedValue(true);

    render(<DeferredApiKeyDialog onSubmit={onSubmit} />);

    const dialog = screen.getByRole("dialog", { name: /API Key/ });
    const env = within(dialog).getByRole("radio", { name: "Import from Env" });
    env.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("env", "ZAI_API_KEY"));
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"));
  });

  it("resets to Paste when reopened after an environment save", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<ApiKeyDialogProps["onSubmit"]>().mockResolvedValue(true);

    render(<ReopenableApiKeyDialog onSubmit={onSubmit} />);

    const dialog = screen.getByRole("dialog", { name: /API Key/ });
    await user.click(within(dialog).getByRole("radio", { name: "Import from Env" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"));
    expect(onSubmit).toHaveBeenCalledWith("env", "ZAI_API_KEY");

    await user.click(screen.getByRole("button", { name: "Reopen API Key" }));
    const reopenedDialog = screen.getByRole("dialog", { name: /API Key/ });
    expect(within(reopenedDialog).getByRole("radio", { name: "Paste Key Now" })).toBeChecked();
    expect(within(reopenedDialog).getByLabelText("Z.AI API Key")).toBeEnabled();
  });

  it.each([
    "Cancel",
    "Escape",
    "backdrop",
  ] as const)("keeps the dialog open when %s is used during a save", async (dismissal) => {
    const user = userEvent.setup();
    const save = createDeferred<boolean>();
    const onSubmit = vi.fn<ApiKeyDialogProps["onSubmit"]>().mockReturnValue(save.promise);

    render(<DeferredApiKeyDialog onSubmit={onSubmit} />);

    const dialog = screen.getByRole("dialog", { name: /API Key/ });
    const keyInput = within(dialog).getByLabelText("Z.AI API Key");
    await user.type(keyInput, "sk-deferred");
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("paste", "sk-deferred"));

    if (dismissal === "Cancel") {
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    } else if (dismissal === "Escape") {
      // fireEvent retained: jsdom does not synthesize a native dialog cancel event from Escape.
      fireEvent(dialog, new Event("cancel", { bubbles: false }));
    } else {
      mockDialogBounds(dialog);
      // fireEvent retained: backdrop dismissal requires matching pointer/click coordinates.
      fireEvent.pointerDown(dialog, { clientX: 80, clientY: 120 });
      fireEvent.click(dialog, { clientX: 80, clientY: 120 });
    }

    expect(screen.getByRole("dialog", { name: /API Key/ })).toBe(dialog);

    await act(async () => {
      save.resolve(true);
      await save.promise;
    });
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"));
  });

  it("returns focus to the trigger button after the dialog closes", async () => {
    const user = userEvent.setup();

    function TriggerStub() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open API Key
          </button>
          <ApiKeyDialog
            open={open}
            onOpenChange={setOpen}
            providerName="Z.AI"
            envVarName="ZAI_API_KEY"
            onSubmit={vi.fn().mockResolvedValue(true)}
          />
        </>
      );
    }

    render(
      <FooterProvider>
        <KeyboardProvider>
          <TriggerStub />
        </KeyboardProvider>
      </FooterProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Open API Key" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: /API Key/ });
    expect(dialog).toBeInTheDocument();

    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    await user.click(cancel);

    // fireEvent retained: animationend has no user-event equivalent; dialog close transition completes on this event
    const dialogElement = document.querySelector("dialog");
    if (dialogElement) fireEvent.animationEnd(dialogElement);

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
