import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ApiKeyMissingView,
  type ApiKeyMissingViewProps,
  ConfigurationErrorView,
} from "./api-key-missing-view";

const PROVIDER_MISSING = ["provider"] as const;

type RenderViewProps = Pick<ApiKeyMissingViewProps, "missing"> &
  Partial<Omit<ApiKeyMissingViewProps, "missing">>;

function renderView(props: RenderViewProps) {
  const onBack = props.onBack ?? vi.fn();
  const onNavigateSettings = props.onNavigateSettings ?? vi.fn();

  const view = render(
    <KeyboardProvider>
      <FooterProvider>
        <ApiKeyMissingView
          activeProvider={props.activeProvider}
          onBack={onBack}
          onNavigateSettings={onNavigateSettings}
          missing={props.missing}
          primaryDisabled={props.primaryDisabled}
        />
      </FooterProvider>
    </KeyboardProvider>,
  );

  return { ...view, onBack, onNavigateSettings };
}

describe("ApiKeyMissingView", () => {
  it("focuses the Configure Provider action by default", async () => {
    renderView({ missing: PROVIDER_MISSING });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });
  });

  it("moves focus between actions with ArrowRight/ArrowLeft", async () => {
    const user = userEvent.setup();
    renderView({ missing: PROVIDER_MISSING });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
  });

  it("Enter on the focused Back action calls only onBack (regression: no double-fire)", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    renderView({ missing: PROVIDER_MISSING, onBack, onNavigateSettings });

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
    renderView({ missing: PROVIDER_MISSING, onBack, onNavigateSettings });

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
    renderView({ missing: PROVIDER_MISSING, onBack, onNavigateSettings });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{Escape}");
    // call-count IS the contract: Escape must fire onBack exactly once (no double-fire regardless of focused action)
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNavigateSettings).not.toHaveBeenCalled();
  });

  it("disables pending provider navigation while keeping Back active", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    renderView({
      missing: PROVIDER_MISSING,
      onBack,
      onNavigateSettings,
      primaryDisabled: true,
    });

    const configure = screen.getByRole("button", { name: "Configure Provider" });
    const back = screen.getByRole("button", { name: "Back to Home" });
    expect(configure).toBeDisabled();
    expect(back).toBeEnabled();
    await waitFor(() => expect(back).toHaveFocus());

    await user.click(configure);
    await user.keyboard("{Escape}");

    expect(onNavigateSettings).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders the storage requirement from the loaded setup status", () => {
    renderView({ missing: ["secretsStorage"] });
    expect(screen.getByText("Secrets Storage Required")).toBeInTheDocument();
  });
});

describe("ConfigurationErrorView", () => {
  it("announces the load failure and lets the user retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <KeyboardProvider>
        <FooterProvider>
          <ConfigurationErrorView onRetry={onRetry} onBack={() => {}} />
        </FooterProvider>
      </KeyboardProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
