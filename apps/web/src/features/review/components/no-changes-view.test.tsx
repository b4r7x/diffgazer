import { FooterProvider } from "@diffgazer/core/footer";
import { getNoChangesCopy } from "@diffgazer/core/review";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NoChangesView, type NoChangesViewProps } from "./no-changes-view";

function renderView(props: Partial<NoChangesViewProps> = {}) {
  const onBack = props.onBack ?? vi.fn();
  const onSwitchMode = props.onSwitchMode;
  const mode: ReviewMode = props.mode ?? "unstaged";

  const view = render(
    <KeyboardProvider>
      <FooterProvider>
        <NoChangesView
          mode={mode}
          onBack={onBack}
          onSwitchMode={onSwitchMode}
          switchDisabled={props.switchDisabled}
        />
      </FooterProvider>
    </KeyboardProvider>,
  );

  return { ...view, onBack, onSwitchMode };
}

describe("NoChangesView", () => {
  it("moves focus from the first action to the second with ArrowRight", async () => {
    const user = userEvent.setup();
    renderView({ onSwitchMode: vi.fn() });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Review Staged" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Review Staged" })).toHaveFocus();
  });

  it("Enter on a focused action calls only that action (regression: no double-fire)", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onSwitchMode = vi.fn();
    renderView({ onBack, onSwitchMode });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Review Staged" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();

    await user.keyboard("{Enter}");
    // call-count IS the contract: this test guards a regression where Enter double-fires (count must be exactly 1, not 2)
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSwitchMode).not.toHaveBeenCalled();
  });

  it("Escape always calls onBack regardless of focused action", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onSwitchMode = vi.fn();
    renderView({ onBack, onSwitchMode });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Review Staged" })).toHaveFocus();
    });

    await user.keyboard("{Escape}");
    // call-count IS the contract: Escape must fire onBack exactly once (no double-fire regardless of focused action)
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSwitchMode).not.toHaveBeenCalled();
  });

  it("disables the pending switch while keeping Back authoritative", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onSwitchMode = vi.fn();
    renderView({ onBack, onSwitchMode, switchDisabled: true });

    const switchButton = screen.getByRole("button", { name: "Review Staged" });
    const backButton = screen.getByRole("button", { name: "Back to Home" });
    expect(switchButton).toBeDisabled();
    expect(backButton).toBeEnabled();
    await waitFor(() => expect(backButton).toHaveFocus());

    await user.keyboard("{Escape}");

    expect(onSwitchMode).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders only the Back button when onSwitchMode is omitted and Enter calls onBack", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderView({ onBack });

    expect(screen.queryByRole("button", { name: /Review/ })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    // call-count IS the contract: Enter must fire onBack exactly once (no double-fire regression)
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("wears the focused reticle while keyboard focus sits inside the panel", async () => {
    const { container } = renderView({ onSwitchMode: vi.fn() });

    // Panel's data attributes are the bracket contract: the frame itself stays
    // at rest (never the viewfinder), and data-state="focused" tracks real
    // focus-within instead of a static claim.
    expect(container.querySelector('[data-frame="viewfinder"]')).toBeNull();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Review Staged" })).toHaveFocus();
    });
    expect(container.querySelector('[data-slot="panel"]')).toHaveAttribute("data-state", "focused");
  });

  it("keeps the focused reticle while the panel holds the parked focus", async () => {
    const user = userEvent.setup();
    const { container } = renderView({ onSwitchMode: vi.fn() });
    const panel = container.querySelector('[data-slot="panel"]');

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Review Staged" })).toHaveFocus();
    });

    // Leaving the action row parks focus on the panel itself, and a parked pane
    // with no reticle is a screen the keyboard drives with no visible signal.
    await user.keyboard("{ArrowUp}");

    expect(panel).toHaveFocus();
    expect(panel).toHaveAttribute("data-state", "focused");
  });

  it("centres the panel between two collapsing spacers", () => {
    const { container } = renderView({ onSwitchMode: vi.fn() });

    // A boxed dead end dead-centres between two equal spacers that collapse
    // once the panel outgrows the viewport. jsdom has no layout, so the
    // placement itself is pinned in desktop-contracts.e2e.ts; what it needs from
    // the markup is the pair of spacers.
    const panel = container.querySelector('[data-slot="panel"]');
    expect(panel?.previousElementSibling).toHaveAttribute("aria-hidden");
    expect(panel?.nextElementSibling).toHaveAttribute("aria-hidden");
  });

  it.each<[ReviewMode, { title: string; switchLabel: string }]>([
    ["staged", { title: "No Staged Changes", switchLabel: "Review Unstaged" }],
    ["unstaged", { title: "No Unstaged Changes", switchLabel: "Review Staged" }],
    ["files", { title: "No Changes in Selected Files", switchLabel: "Review Unstaged" }],
  ])("renders %s mode title, remediation body, and switch label", (mode, {
    title,
    switchLabel,
  }) => {
    renderView({ mode, onSwitchMode: vi.fn() });
    const { message } = getNoChangesCopy(mode);

    // The mode-dependent headline is a real heading in the content flow, not
    // the static corner chip: the chip names the kind of dead end, the heading
    // says which one.
    expect(screen.getByRole("heading", { level: 2, name: title })).toBeVisible();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: switchLabel })).toBeInTheDocument();
  });
});
