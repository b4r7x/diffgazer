import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyMissingView, type ApiKeyMissingViewProps } from "./api-key-missing-view";

function renderView(props: Partial<ApiKeyMissingViewProps> = {}) {
  const onBack = props.onBack ?? vi.fn();
  const onNavigateSettings = props.onNavigateSettings ?? vi.fn();

  const view = render(
    <KeyboardProvider>
      <FooterProvider>
        <ApiKeyMissingView
          activeProvider={props.activeProvider}
          onBack={onBack}
          onNavigateSettings={onNavigateSettings}
          missingModel={props.missingModel}
        />
      </FooterProvider>
    </KeyboardProvider>,
  );

  return { ...view, onBack, onNavigateSettings };
}

describe("ApiKeyMissingView", () => {
  it("focuses the Configure Provider action by default", async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });
  });

  it("moves focus between actions with ArrowRight/ArrowLeft", async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
  });

  it("clamps at both action boundaries without wrapping", async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();
  });

  it("Enter on the focused Back action calls only onBack (regression: no double-fire)", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    renderView({ onBack, onNavigateSettings });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();

    await user.keyboard("{Enter}");
    // call-count IS the contract: this test guards a regression where Enter double-fires (count must be exactly 1, not 2)
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNavigateSettings).not.toHaveBeenCalled();
  });

  it("Enter on the focused Configure Provider action calls only onNavigateSettings", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    renderView({ onBack, onNavigateSettings });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    // call-count IS the contract: Enter on focused action must fire exactly once (no double-fire regression)
    expect(onNavigateSettings).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("Escape always calls onBack regardless of focused action", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    renderView({ onBack, onNavigateSettings });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{Escape}");
    // call-count IS the contract: Escape must fire onBack exactly once (no double-fire regardless of focused action)
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNavigateSettings).not.toHaveBeenCalled();
  });

  it("renders API Key Required title by default", () => {
    renderView();
    expect(screen.getByText("API Key Required")).toBeInTheDocument();
  });

  it("renders Model Required title when missingModel is true", () => {
    renderView({ missingModel: true });
    expect(screen.getByText("Model Required")).toBeInTheDocument();
  });
});
