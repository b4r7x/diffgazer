import { FooterProvider } from "@diffgazer/core/footer";
import type { ProviderListRow } from "@diffgazer/core/providers";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { ProviderManagementOutcome } from "@diffgazer/core/providers/hooks";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import {
  buildProviderRows,
  makeReadiness,
  unconfiguredRow,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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

function requireProviderRow(predicate: (row: ProviderListRow) => boolean): ProviderListRow {
  const row = buildProviderRows().find(predicate);
  if (!row) {
    throw new Error("Expected provider row fixture was not found");
  }
  return row;
}

const SUCCEEDED = { status: "succeeded" } as const;

function renderSetupDialog(
  row: ProviderListRow,
  handlers: Partial<Pick<ApiKeyDialogProps, "onCreate" | "onUpdate">> = {},
) {
  const onCreate = vi.fn().mockResolvedValue(SUCCEEDED);
  const onUpdate = vi.fn().mockResolvedValue(SUCCEEDED);
  const onOpenChange = vi.fn();

  render(
    <FooterProvider>
      <KeyboardProvider>
        <ApiKeyDialog
          open
          row={row}
          onOpenChange={onOpenChange}
          onCreate={handlers.onCreate ?? onCreate}
          onUpdate={handlers.onUpdate ?? onUpdate}
        />
      </KeyboardProvider>
    </FooterProvider>,
  );

  return { onCreate, onUpdate, onOpenChange };
}

describe("ApiKeyDialog setup controls", () => {
  it("shows hosted credential methods for hosted-api setup", () => {
    renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: "Paste Key Now" })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Import from Env" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Google Gemini API Key/i)).toBeInTheDocument();
  });
});

describe("ApiKeyDialog acknowledgement and write-only secrets", () => {
  // The provider consent is gated before this dialog opens, so a fresh product
  // saves with its notice acknowledged for the user: no checkbox, no consent text.
  it("sends the product acknowledgement without a checkbox and shows the notice for information", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    for (const line of PRODUCT_REGISTRY.gemini.notice.privacy) {
      expect(within(dialog).getByText(line)).toBeInTheDocument();
    }
    await user.type(within(dialog).getByLabelText(/Google Gemini API Key/i), "sk-hosted-secret");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        transportFamily: "hosted-api",
        productId: "gemini",
        credential: { kind: "literal", value: "sk-hosted-secret" },
      }),
      expect.objectContaining({
        acknowledgement: expect.objectContaining({
          status: "accepted",
          noticeId: "gemini-hosted-api",
        }),
      }),
    );
  });

  it("asks for an explicit acceptance when the row's notice needs accepting again", async () => {
    const user = userEvent.setup();
    const row = requireProviderRow(
      (candidate) => candidate.configuration?.configurationId === "gemini-primary",
    );
    const { onUpdate } = renderSetupDialog({
      ...row,
      readiness: makeReadiness("acknowledgement-required", "gemini"),
    });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/needs your acceptance/i)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Google Gemini API Key/i), "sk-rotated-key");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: /i accept/i }));
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
  });

  it("submits environment credentials without keeping the typed secret in the DOM", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog");
    // Down from Paste lands in the key field; the secret typed there is abandoned
    // when Down again reaches Import from Env.
    await user.keyboard("{ArrowDown}");
    await user.keyboard("sk-typed-then-abandoned");
    expect(within(dialog).getByLabelText(/Gemini API Key/i)).toHaveValue("sk-typed-then-abandoned");
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        credential: { kind: "environment" },
      }),
      expect.anything(),
    );
    expect(dialog.textContent).not.toContain("sk-typed-then-abandoned");
  });

  it("announces a failed save inline and marks the key input invalid without a toast", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => {
      throw new Error("Storage not configured");
    });

    render(
      <FooterProvider>
        <KeyboardProvider>
          <ApiKeyDialog
            open
            onOpenChange={vi.fn()}
            row={unconfiguredRow("gemini")}
            onCreate={onCreate}
            onUpdate={vi.fn()}
          />
        </KeyboardProvider>
      </FooterProvider>,
    );

    const dialog = screen.getByRole("dialog");
    const keyInput = within(dialog).getByLabelText(/Google Gemini API Key/i);
    await user.type(keyInput, "sk-test-key");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Storage not configured");
    expect(keyInput).toHaveAttribute("aria-invalid", "true");
    expect(keyInput).toHaveAttribute("aria-describedby", alert.id);
    expect(dialog.textContent).not.toContain("sk-test-key");
    expect(dialog).toBeInTheDocument();
  });
});

describe("ApiKeyDialog chrome and environment binding", () => {
  it("renders the header strip title and the default [x] close control", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: /Create Configuration/ }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close dialog" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("previews the $ENV variable the environment method binds", () => {
    renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("textbox", { name: "GOOGLE_API_KEY environment variable" }),
    ).toHaveValue("GOOGLE_API_KEY");
  });

  it("keeps the confirm action visible while the key is empty, then enables it", async () => {
    const user = userEvent.setup();
    renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).toBeVisible();
    expect(save).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Google Gemini API Key/i), "sk-hosted-secret");

    expect(save).toBeEnabled();
  });
});

describe("ApiKeyDialog accessible submit, cancel, and focus", () => {
  it("reads the standard key legend — Space Select, Enter Save, Esc Cancel — while open", () => {
    renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog", { name: /Create Configuration/ });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeInTheDocument();

    const kbdNodes = within(dialog).getAllByText((_, element) => element?.tagName === "KBD");
    const kbdTexts = kbdNodes.map((node) => node.textContent);
    expect(kbdTexts).toEqual(["Space", "Enter", "Esc"]);
  });

  it("submits the method committed with Enter on the real selector", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(SUCCEEDED);

    function StatefulDialog() {
      const [open, setOpen] = useState(true);
      return (
        <ApiKeyDialog
          open={open}
          onOpenChange={setOpen}
          row={unconfiguredRow("gemini")}
          onCreate={onCreate}
          onUpdate={vi.fn()}
        />
      );
    }

    render(
      <FooterProvider>
        <KeyboardProvider>
          <StatefulDialog />
        </KeyboardProvider>
      </FooterProvider>,
    );

    const dialog = screen.getByRole("dialog");
    // Down from Paste lands in the key field, Down again reaches Import from Env.
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ credential: { kind: "environment" } }),
      expect.anything(),
    );
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"));
  });

  it.each([
    "Cancel",
    "Escape",
    "backdrop",
  ] as const)("keeps the dialog open when %s is used during a save", async (dismissal) => {
    const user = userEvent.setup();
    const save = createDeferred<ProviderManagementOutcome>();
    const onCreate = vi.fn().mockReturnValue(save.promise);

    function StatefulDialog() {
      const [open, setOpen] = useState(true);
      return (
        <ApiKeyDialog
          open={open}
          onOpenChange={setOpen}
          row={unconfiguredRow("gemini")}
          onCreate={onCreate}
          onUpdate={vi.fn()}
        />
      );
    }

    render(
      <FooterProvider>
        <KeyboardProvider>
          <StatefulDialog />
        </KeyboardProvider>
      </FooterProvider>,
    );

    const dialog = screen.getByRole("dialog");
    const keyInput = within(dialog).getByLabelText(/Google Gemini API Key/i);
    await user.type(keyInput, "sk-deferred");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());

    if (dismissal === "Cancel") {
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    } else if (dismissal === "Escape") {
      // fireEvent retained: dialog cancel is a native Event; userEvent has no cancel dispatch.
      fireEvent(dialog, new Event("cancel", { bubbles: false }));
    } else {
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
      // fireEvent retained: outside-click dismissal needs exact client coordinates vs getBoundingClientRect.
      fireEvent.pointerDown(dialog, { clientX: 80, clientY: 120 });
      // fireEvent retained: outside-click dismissal needs exact client coordinates vs getBoundingClientRect.
      fireEvent.click(dialog, { clientX: 80, clientY: 120 });
    }

    expect(screen.getByRole("dialog")).toBe(dialog);

    await act(async () => {
      save.resolve(SUCCEEDED);
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
            Open Setup
          </button>
          <ApiKeyDialog
            open={open}
            onOpenChange={setOpen}
            row={unconfiguredRow("gemini")}
            onCreate={vi.fn().mockResolvedValue(SUCCEEDED)}
            onUpdate={vi.fn()}
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

    const trigger = screen.getByRole("button", { name: "Open Setup" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    const dialogElement = document.querySelector("dialog");
    // fireEvent retained: animationend has no user-event equivalent; the libs/ui dialog
    // completes its close presence transition — and restores focus — on this event.
    if (dialogElement) fireEvent.animationEnd(dialogElement);

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
