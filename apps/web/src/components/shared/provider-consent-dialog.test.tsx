import { PROVIDER_CONSENT_TEXT } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axeCore from "axe-core";
import { type ComponentProps, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProviderConsentDialog } from "./provider-consent-dialog";

const ACCEPTED = { version: 1 as const, acceptedAt: "2026-08-18T10:00:00.000Z" };

function renderDialog(overrides: Partial<ComponentProps<typeof ProviderConsentDialog>> = {}) {
  const props: ComponentProps<typeof ProviderConsentDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    consent: null,
    continues: true,
    isAccepting: false,
    error: null,
    onAccept: vi.fn(),
    ...overrides,
  };
  const view = render(
    <KeyboardProvider>
      <ProviderConsentDialog {...props} />
    </KeyboardProvider>,
  );
  return { ...view, props };
}

function dialog(): HTMLElement {
  return screen.getByRole("alertdialog", { name: "Provider data notice" });
}

// Colour contrast is a token contract jsdom cannot compute.
async function expectNoAxeViolations(container: Element) {
  const results = await axeCore.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations).toEqual([]);
}

describe("ProviderConsentDialog", () => {
  it("is a modal alert dialog that opens on Accept and continue, with the notice and its link", async () => {
    renderDialog();

    const alert = dialog();
    expect(alert).toHaveAttribute("aria-modal", "true");
    expect(alert).toHaveAccessibleDescription("Asked once, before anything is sent to a provider");
    expect(within(alert).getByText(PROVIDER_CONSENT_TEXT)).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: /Privacy notes/ })).toHaveAttribute(
      "href",
      "https://github.com/b4r7x/diffgazer#privacy",
    );
    await waitFor(() =>
      expect(within(alert).getByRole("button", { name: "Accept and continue" })).toHaveFocus(),
    );
    await expectNoAxeViolations(document.body);
  });

  it("stacks the description under a title-only heading and keeps hints and actions in one footer", () => {
    renderDialog();

    const alert = dialog();
    const heading = within(alert).getByRole("heading", { name: "Provider data notice" });
    expect(heading).toHaveTextContent(/^Provider data notice$/);
    expect(heading.nextElementSibling).toHaveTextContent(
      "Asked once, before anything is sent to a provider",
    );

    const footer = alert.querySelector('[data-slot="dialog-footer"]');
    if (!footer) throw new Error("Expected the dialog footer");
    const hints = within(footer as HTMLElement).getAllByText(/^(Enter|Esc)$/);
    expect(hints).toHaveLength(2);
    expect(alert.querySelectorAll('[data-slot="overlay-hints"]')).toHaveLength(1);
    expect(
      within(footer as HTMLElement).getByRole("button", { name: "Not now" }),
    ).toBeInTheDocument();
    expect(
      within(footer as HTMLElement).getByRole("button", { name: "Accept and continue" }),
    ).toBeInTheDocument();
  });

  it("keeps Tab inside the notice and answers Enter with the acceptance, not a close", async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    const accept = screen.getByRole("button", { name: "Accept and continue" });
    const notNow = screen.getByRole("button", { name: "Not now" });
    const link = screen.getByRole("link", { name: /Privacy notes/ });
    await waitFor(() => expect(accept).toHaveFocus());

    await user.tab();
    expect(link).toHaveFocus();
    await user.tab();
    expect(notNow).toHaveFocus();
    await user.tab();
    expect(accept).toHaveFocus();
    await user.tab({ shift: true });
    expect(notNow).toHaveFocus();
    await user.tab({ shift: true });
    expect(link).toHaveFocus();
    await user.tab({ shift: true });
    expect(accept).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(props.onAccept).toHaveBeenCalledOnce();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it("moves between Not now and Accept with Left/Right and answers Enter with the focused one", async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    const accept = screen.getByRole("button", { name: "Accept and continue" });
    const notNow = screen.getByRole("button", { name: "Not now" });
    await waitFor(() => expect(accept).toHaveFocus());

    await user.keyboard("{ArrowRight}");
    expect(accept).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(notNow).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(notNow).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(accept).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{Enter}");
    expect(props.onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it("steps up from the action row to the privacy link and back down with the arrows", async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    const accept = screen.getByRole("button", { name: "Accept and continue" });
    const notNow = screen.getByRole("button", { name: "Not now" });
    const link = screen.getByRole("link", { name: /Privacy notes/ });
    await waitFor(() => expect(accept).toHaveFocus());

    await user.keyboard("{ArrowUp}");
    expect(link).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(notNow).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(accept).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(props.onAccept).toHaveBeenCalledOnce();
  });

  it("keeps Left on the acceptance while it is being saved", async () => {
    const user = userEvent.setup();
    renderDialog({ isAccepting: true });

    const accept = screen.getByRole("button", { name: "Accept and continue" });
    await waitFor(() => expect(accept).toHaveFocus());

    await user.keyboard("{ArrowLeft}");
    expect(accept).toHaveFocus();
  });

  it("closes on Not now and on Escape without accepting", async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Not now" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);

    // fireEvent retained: dialog cancel is a native Event; userEvent has no cancel dispatch.
    fireEvent(dialog(), new Event("cancel", { bubbles: false }));
    expect(props.onOpenChange).toHaveBeenCalledTimes(2);
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it("holds the notice open while the acceptance is being saved", () => {
    const { props } = renderDialog({ isAccepting: true });

    expect(screen.getByRole("button", { name: "Not now" })).toBeDisabled();
    // fireEvent retained: dialog cancel is a native Event; userEvent has no cancel dispatch.
    fireEvent(dialog(), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it("names the plain acceptance when nothing waits behind the notice", () => {
    renderDialog({ continues: false });

    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept and continue" })).not.toBeInTheDocument();
  });

  it("reads an accepted notice back with its date and a single, focused Close", async () => {
    const user = userEvent.setup();
    const { props } = renderDialog({ consent: ACCEPTED, continues: false });

    const alert = dialog();
    expect(alert).toHaveAccessibleDescription(/^Accepted 2026-08-1[89]$/);
    expect(within(alert).queryByRole("button", { name: /Accept/ })).not.toBeInTheDocument();
    expect(within(alert).queryByRole("button", { name: "Not now" })).not.toBeInTheDocument();
    // Enter closes; it must not follow the privacy link that comes first in the DOM.
    const close = within(alert).getByRole("button", { name: "Close" });
    await waitFor(() => expect(close).toHaveFocus());
    await expectNoAxeViolations(document.body);

    await user.keyboard("{Enter}");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it("returns focus to the control that opened it once it closes", async () => {
    const user = userEvent.setup();

    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <KeyboardProvider>
          <button type="button" onClick={() => setOpen(true)}>
            Verify
          </button>
          <ProviderConsentDialog
            open={open}
            onOpenChange={setOpen}
            consent={null}
            continues
            isAccepting={false}
            error={null}
            onAccept={vi.fn()}
          />
        </KeyboardProvider>
      );
    }
    render(<Host />);

    const trigger = screen.getByRole("button", { name: "Verify" });
    await user.click(trigger);
    const alert = await screen.findByRole("alertdialog", { name: "Provider data notice" });
    await waitFor(() =>
      expect(within(alert).getByRole("button", { name: "Accept and continue" })).toHaveFocus(),
    );

    await user.click(within(alert).getByRole("button", { name: "Not now" }));
    // fireEvent retained: animationend has no user-event equivalent; the libs/ui dialog
    // completes its close presence transition — and restores focus — on this event.
    fireEvent.animationEnd(alert);

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("opens on Accept again after Not now was focused and chosen", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();

    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <KeyboardProvider>
          <button type="button" onClick={() => setOpen(true)}>
            Verify
          </button>
          <ProviderConsentDialog
            open={open}
            onOpenChange={setOpen}
            consent={null}
            continues={false}
            isAccepting={false}
            error={null}
            onAccept={onAccept}
          />
        </KeyboardProvider>
      );
    }
    render(<Host />);

    const trigger = screen.getByRole("button", { name: "Verify" });
    await user.click(trigger);
    let alert = await screen.findByRole("alertdialog", { name: "Provider data notice" });
    await waitFor(() =>
      expect(within(alert).getByRole("button", { name: "Accept" })).toHaveFocus(),
    );
    await user.keyboard("{ArrowLeft}");
    expect(within(alert).getByRole("button", { name: "Not now" })).toHaveFocus();
    await user.keyboard("{Enter}");
    // fireEvent retained: animationend has no user-event equivalent; the libs/ui dialog
    // completes its close presence transition on this event.
    fireEvent.animationEnd(alert);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onAccept).not.toHaveBeenCalled();

    await user.click(trigger);
    alert = await screen.findByRole("alertdialog", { name: "Provider data notice" });
    await waitFor(() =>
      expect(within(alert).getByRole("button", { name: "Accept" })).toHaveFocus(),
    );
    await user.keyboard("{Enter}");
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
