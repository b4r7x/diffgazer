import { FooterProvider } from "@diffgazer/core/footer";
import type { ProviderListRow, ProviderManagementOutcome } from "@diffgazer/core/providers";
import type { ClientConfigurationSummary } from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import {
  buildProviderRows,
  LOCAL_OPENAI_CONFIGURATION,
  unconfiguredRow,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ApiKeyDialog } from "./dialog";

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

function localHttpRow(): ProviderListRow {
  return requireProviderRow((row) => row.configuration?.configurationId === "local-openai-1");
}

function localCliRow(): ProviderListRow {
  return requireProviderRow((row) => row.product.productId === "codex-cli");
}

import type { ApiKeyDialogProps } from "./dialog";

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

describe("ApiKeyDialog family-specific setup controls", () => {
  it("shows hosted credential methods for hosted-api setup", () => {
    renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: "Paste Key Now" })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Import from Env" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Google Gemini API Key/i)).toBeInTheDocument();
  });

  it("forbids credential controls for local-http setup", () => {
    renderSetupDialog(localHttpRow());

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/without storing hosted credentials/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole("radio", { name: "Paste Key Now" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });

  it("forbids credential controls for local-cli setup", () => {
    renderSetupDialog(localCliRow());

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/without storing hosted credentials/i)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("radio", { name: "Import from Env" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });

  it("forbids CLI credential, token, and path inputs for local-cli setup", () => {
    renderSetupDialog(localCliRow());

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText(/token/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/path/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/credential/i)).not.toBeInTheDocument();
  });
});

describe("ApiKeyDialog acknowledgement and write-only secrets", () => {
  it("requires explicit notice acknowledgement before hosted save", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog");
    const keyInput = within(dialog).getByLabelText(/Google Gemini API Key/i);
    await user.type(keyInput, "sk-hosted-secret");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(onCreate).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("checkbox", { name: /accept billing/i }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        transportFamily: "hosted-api",
        productId: "gemini",
        credential: { kind: "literal", value: "sk-hosted-secret" },
      }),
      expect.anything(),
    );
  });

  it("submits environment credentials without keeping the typed secret in the DOM", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox", { name: /accept billing/i }));
    await user.keyboard("{ArrowUp}{Enter}");

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        credential: { kind: "environment" },
      }),
      expect.anything(),
    );
    expect(dialog.textContent).not.toContain("sk-");
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
    await user.click(within(dialog).getByRole("checkbox", { name: /accept billing/i }));
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

describe("ApiKeyDialog chrome, consent gating, and environment binding", () => {
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

  it("keeps the confirm action visible while consent is outstanding, then enables it", async () => {
    const user = userEvent.setup();
    renderSetupDialog(unconfiguredRow("gemini"));

    const dialog = screen.getByRole("dialog");
    const save = within(dialog).getByRole("button", { name: "Save" });
    await user.type(within(dialog).getByLabelText(/Google Gemini API Key/i), "sk-hosted-secret");

    expect(save).toBeVisible();
    expect(save).toBeDisabled();

    await user.click(within(dialog).getByRole("checkbox", { name: /accept billing/i }));

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
    await user.click(within(dialog).getByRole("checkbox", { name: /accept billing/i }));
    await user.keyboard("{ArrowUp}{Enter}");

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
    await user.click(within(dialog).getByRole("checkbox", { name: /accept billing/i }));
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

  it("renders a rejected local-http save inline and keeps the dialog open", async () => {
    const user = userEvent.setup();
    const onUpdate = vi
      .fn()
      .mockResolvedValue({ status: "failed", message: "Local endpoint rejected the write" });
    const onOpenChange = vi.fn();

    render(
      <FooterProvider>
        <KeyboardProvider>
          <ApiKeyDialog
            open
            row={localHttpRow()}
            onOpenChange={onOpenChange}
            onCreate={vi.fn().mockResolvedValue(SUCCEEDED)}
            onUpdate={onUpdate}
          />
        </KeyboardProvider>
      </FooterProvider>,
    );

    const dialog = screen.getByRole("dialog");
    // A configured row already accepted the current notice, so the dialog opens
    // with the acknowledgement checked and the save only needs the button.
    expect(within(dialog).getByRole("checkbox", { name: /accept billing/i })).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Local endpoint rejected the write",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
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

  it("completes local-http setup without key or env controls", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderSetupDialog(localHttpRow());

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("checkbox", { name: /accept billing/i })).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          transportFamily: "local-http",
          productId: "local-openai",
          endpoint: (
            LOCAL_OPENAI_CONFIGURATION as Extract<
              ClientConfigurationSummary,
              { transportFamily: "local-http" }
            >
          ).endpoint,
          authentication: "none",
          presetId: "lm-studio",
        }),
        acknowledgement: expect.objectContaining({ status: "accepted" }),
      }),
      expect.anything(),
    );
    expect(dialog.textContent).not.toContain("sk-");
  });
});
