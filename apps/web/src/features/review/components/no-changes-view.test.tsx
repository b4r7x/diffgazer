import { FooterProvider } from "@diffgazer/core/footer";
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

  it.each<[ReviewMode, { title: string; switchLabel: string }]>([
    ["staged", { title: "No Staged Changes", switchLabel: "Review Unstaged" }],
    ["unstaged", { title: "No Unstaged Changes", switchLabel: "Review Staged" }],
    ["files", { title: "No Changes in Selected Files", switchLabel: "Review Unstaged" }],
  ])("renders %s mode title and switch label", (mode, { title, switchLabel }) => {
    renderView({ mode, onSwitchMode: vi.fn() });

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: switchLabel })).toBeInTheDocument();
  });
});
