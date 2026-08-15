import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FailureView, type FailureViewProps } from "./failure-view";

function FooterProbe() {
  const { shortcuts } = useFooterData();
  return (
    <output>{shortcuts.map((shortcut) => `${shortcut.key}:${shortcut.label}`).join("|")}</output>
  );
}

function renderFailure(overrides: Partial<FailureViewProps> = {}) {
  const props: FailureViewProps = {
    title: "Reviews Unavailable",
    message: "Diffgazer could not read the review history.",
    scope: "failure-view-test",
    primary: { label: "Retry", onAction: vi.fn() },
    secondary: { label: "Back to Home", onAction: vi.fn() },
    ...overrides,
  };

  const view = render(
    <FooterProvider>
      <KeyboardProvider>
        <FailureView {...props} />
        <FooterProbe />
      </KeyboardProvider>
    </FooterProvider>,
  );

  return { ...view, props };
}

describe("FailureView", () => {
  it("announces the failure and focuses the primary action on mount", async () => {
    renderFailure();

    expect(screen.getByRole("alert")).toHaveTextContent("Reviews Unavailable");
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());
  });

  it("moves between the two actions with the arrow keys", async () => {
    const user = userEvent.setup();
    renderFailure();

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();
  });

  it("maps Escape to the secondary action", async () => {
    const user = userEvent.setup();
    const onSecondary = vi.fn();
    renderFailure({ secondary: { label: "Back to Home", onAction: onSecondary } });

    await user.keyboard("{Escape}");

    expect(onSecondary).toHaveBeenCalledOnce();
  });

  it("renders one action and maps Escape to it when the dead end has no secondary", async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();
    render(
      <FooterProvider>
        <KeyboardProvider>
          <FailureView
            title="Review Failed"
            message="The provider dropped the connection."
            scope="failure-view-single-action-test"
            primary={{ label: "Back to Home", onAction: onPrimary }}
          />
          <FooterProbe />
        </KeyboardProvider>
      </FooterProvider>,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
    // Nowhere to move to, so the row hint stays off this screen.
    expect(screen.getByRole("status")).not.toHaveTextContent("Move Action");

    await user.keyboard("{Escape}");

    expect(onPrimary).toHaveBeenCalledOnce();
  });

  it("publishes the focused action in the page footer", async () => {
    const user = userEvent.setup();
    renderFailure();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Enter/Space:Retry"));
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("status")).toHaveTextContent("Enter/Space:Back to Home");
  });

  it("walks primary, recovery, and secondary with the arrow keys", async () => {
    const user = userEvent.setup();
    renderFailure({ recovery: { label: "Configure Provider", onAction: vi.fn() } });

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();
  });

  it("activates only the recovery action and keeps it off the Escape path", async () => {
    const user = userEvent.setup();
    const onRecovery = vi.fn();
    const { props } = renderFailure({
      recovery: { label: "Configure Provider", onAction: onRecovery },
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");

    expect(onRecovery).toHaveBeenCalledOnce();
    expect(props.primary.onAction).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");

    expect(props.secondary?.onAction).toHaveBeenCalledOnce();
    expect(onRecovery).toHaveBeenCalledOnce();
  });

  it("seats the resting panel in the optical band with its tone tint", () => {
    const { container } = renderFailure();

    // Panel data attributes are the documented contract: the failure tone tints
    // the hairline and the panel stays a resting frame, never the viewfinder.
    const panel = container.querySelector('[data-slot="panel"]');
    expect(panel).toHaveAttribute("data-tone", "error");
    expect(panel).not.toHaveAttribute("data-frame", "viewfinder");

    // The collapsing spacers around the panel are the centering contract — the
    // panel sits in the shared 1:2 optical band, not dead-center in the leftover
    // space below the header.
    expect(panel?.previousElementSibling).toHaveAttribute("aria-hidden");
    expect(panel?.nextElementSibling).toHaveAttribute("aria-hidden");
  });

  it("tints a warning gate with the warning tone", () => {
    const { container } = renderFailure({ tone: "warning" });

    expect(container.querySelector('[data-slot="panel"]')).toHaveAttribute("data-tone", "warning");
  });

  it("keeps a warning-tone gate out of the alert channel", () => {
    renderFailure({ tone: "warning", title: "API Key Required" });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "API Key Required" })).toBeVisible();
  });

  it("renders the title at the requested heading level", () => {
    renderFailure({ titleAs: "h1", title: "Page Not Found" });

    expect(screen.getByRole("heading", { level: 1, name: "Page Not Found" })).toBeVisible();
  });
});
