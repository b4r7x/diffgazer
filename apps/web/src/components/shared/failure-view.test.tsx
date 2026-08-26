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

function failureProps(overrides: Partial<FailureViewProps> = {}): FailureViewProps {
  return {
    title: "Reviews Unavailable",
    message: "Diffgazer could not read the review history.",
    scope: "failure-view-test",
    primary: { label: "Retry", onAction: vi.fn() },
    secondary: { label: "Back to Home", onAction: vi.fn() },
    ...overrides,
  };
}

function failureTree(props: FailureViewProps) {
  return (
    <FooterProvider>
      <KeyboardProvider>
        <FailureView {...props} />
        <FooterProbe />
      </KeyboardProvider>
    </FooterProvider>
  );
}

function renderFailure(overrides: Partial<FailureViewProps> = {}) {
  const props = failureProps(overrides);

  return { ...render(failureTree(props)), props };
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
      failureTree({
        title: "Review Failed",
        message: "The provider dropped the connection.",
        scope: "failure-view-single-action-test",
        primary: { label: "Back to Home", onAction: onPrimary },
      }),
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

    // Index 2 is the row's boundary: one more step must not wrap or eject.
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

  it("keeps the focused reticle on the panel while focus parks there mid-mutation", async () => {
    const props = failureProps({ scope: "failure-view-park-test" });
    const { container, rerender } = render(failureTree(props));

    // The reticle follows real focus: mount focus sits on the primary action
    // inside the panel, so the panel claims the corner brackets.
    const panel = container.querySelector('[data-slot="panel"]');
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());
    expect(panel).toHaveAttribute("data-state", "focused");

    // Every action disables mid-mutation: the row parks focus on the panel
    // itself, and the parked panel must keep the visible reticle.
    rerender(
      failureTree({
        ...props,
        primary: { ...props.primary, disabled: true },
        secondary: props.secondary && { ...props.secondary, disabled: true },
      }),
    );

    await waitFor(() => expect(panel).toHaveFocus());
    expect(panel).toHaveAttribute("data-state", "focused");
  });

  it("centres the panel between two collapsing spacers with its tone tint", () => {
    const { container } = renderFailure();

    // Panel data attributes are the documented contract: the failure tone tints
    // the hairline and the panel stays a resting frame, never the viewfinder.
    const panel = container.querySelector('[data-slot="panel"]');
    expect(panel).toHaveAttribute("data-tone", "error");
    expect(panel).not.toHaveAttribute("data-frame", "viewfinder");

    // A boxed dead end dead-centres between two equal spacers that collapse
    // once the panel outgrows the viewport. jsdom has no layout, so the
    // placement itself is pinned in desktop-contracts.e2e.ts; what it needs from
    // the markup is the pair of spacers.
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

  it("marks the error title with an aria-hidden glyph outside the accessible name", () => {
    renderFailure();

    const heading = screen.getByRole("heading", { name: "Reviews Unavailable" });
    const glyph = heading.querySelector('[aria-hidden="true"]');
    expect(glyph).toHaveTextContent("✖");
  });

  it("swaps the title glyph for the warning tone", () => {
    renderFailure({ tone: "warning" });

    const heading = screen.getByRole("heading", { name: "Reviews Unavailable" });
    expect(heading.querySelector('[aria-hidden="true"]')).toHaveTextContent("⚠");
  });

  it("stitches the interrupted rule under the meta line", () => {
    renderFailure({ meta: "openai / gpt-5" });

    const stitch = screen.getByText("openai / gpt-5").nextElementSibling;
    expect(stitch).toHaveAttribute("aria-hidden", "true");
    expect(stitch?.children).toHaveLength(2);
  });

  it("omits the stitch when the gate has no meta line", () => {
    renderFailure();

    const message = screen.getByText("Diffgazer could not read the review history.");
    expect(message.previousElementSibling).not.toHaveAttribute("aria-hidden");
  });

  it("renders the title at the requested heading level", () => {
    renderFailure({ titleAs: "h1", title: "Page Not Found" });

    expect(screen.getByRole("heading", { level: 1, name: "Page Not Found" })).toBeVisible();
  });
});
