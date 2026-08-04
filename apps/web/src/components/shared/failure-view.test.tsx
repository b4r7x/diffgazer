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

  render(
    <FooterProvider>
      <KeyboardProvider>
        <FailureView {...props} />
        <FooterProbe />
      </KeyboardProvider>
    </FooterProvider>,
  );

  return props;
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
