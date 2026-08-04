import { FooterProvider } from "@diffgazer/core/footer";
import { readinessUsesTransportNeutralCopy } from "@diffgazer/core/review";
import { REMOVED_PRODUCT_ID } from "@diffgazer/core/schemas/config";
import {
  CLI_UNSUPPORTED_CONFIGURATION,
  LOCAL_OPENAI_CONFIGURATION,
  makeReadiness,
  REMOVED_ZAI_CODING_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getReadinessActionLabel } from "../lib/readiness-presentation";
import {
  ApiKeyMissingView,
  type ApiKeyMissingViewProps,
  ConfigurationErrorView,
  ReviewTerminalErrorView,
  ReviewTerminalReceiptView,
} from "./api-key-missing-view";

type RenderViewProps = Pick<ApiKeyMissingViewProps, "readiness" | "primaryLabel"> &
  Partial<Omit<ApiKeyMissingViewProps, "readiness" | "primaryLabel">>;

function renderView(props: RenderViewProps) {
  const readiness = props.readiness ?? makeReadiness("unconfigured");
  const onBack = props.onBack ?? vi.fn();
  const onNavigateSettings = props.onNavigateSettings ?? vi.fn();
  const primaryLabel = props.primaryLabel ?? getReadinessActionLabel(readiness.action);

  const view = render(
    <KeyboardProvider>
      <FooterProvider>
        <ApiKeyMissingView
          readiness={readiness}
          productLabel={props.productLabel}
          primaryLabel={primaryLabel}
          onBack={onBack}
          onNavigateSettings={onNavigateSettings}
          primaryDisabled={props.primaryDisabled}
        />
      </FooterProvider>
    </KeyboardProvider>,
  );

  return { ...view, onBack, onNavigateSettings, readiness, primaryLabel };
}

describe("ApiKeyMissingView", () => {
  it("focuses the readiness action by default", async () => {
    const readiness = makeReadiness("unconfigured");
    renderView({ readiness, primaryLabel: getReadinessActionLabel(readiness.action) });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create configuration" })).toHaveFocus();
    });
  });

  it("moves focus between actions with ArrowRight/ArrowLeft", async () => {
    const user = userEvent.setup();
    const readiness = makeReadiness("unconfigured");
    renderView({ readiness, primaryLabel: getReadinessActionLabel(readiness.action) });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create configuration" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Create configuration" })).toHaveFocus();
  });

  it("Enter on the focused Back action calls only onBack (regression: no double-fire)", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    const readiness = makeReadiness("unconfigured");
    renderView({
      readiness,
      primaryLabel: getReadinessActionLabel(readiness.action),
      onBack,
      onNavigateSettings,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create configuration" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNavigateSettings).not.toHaveBeenCalled();
  });

  it("Enter on the focused readiness action calls only onNavigateSettings", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    const readiness = makeReadiness("unconfigured");
    renderView({
      readiness,
      primaryLabel: getReadinessActionLabel(readiness.action),
      onBack,
      onNavigateSettings,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create configuration" })).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    expect(onNavigateSettings).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("Escape always calls onBack regardless of focused action", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    const readiness = makeReadiness("unconfigured");
    renderView({
      readiness,
      primaryLabel: getReadinessActionLabel(readiness.action),
      onBack,
      onNavigateSettings,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create configuration" })).toHaveFocus();
    });

    await user.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNavigateSettings).not.toHaveBeenCalled();
  });

  it("disables pending provider navigation while keeping Back active", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    const readiness = makeReadiness("unconfigured");
    renderView({
      readiness,
      primaryLabel: getReadinessActionLabel(readiness.action),
      onBack,
      onNavigateSettings,
      primaryDisabled: true,
    });

    const configure = screen.getByRole("button", { name: "Create configuration" });
    const back = screen.getByRole("button", { name: "Back to Home" });
    expect(configure).toBeDisabled();
    expect(back).toBeEnabled();
    await waitFor(() => expect(back).toHaveFocus());

    await user.click(configure);
    await user.keyboard("{Escape}");

    expect(onNavigateSettings).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders transport-neutral local unreachable readiness without API-key copy", () => {
    const readiness = makeReadiness("local-endpoint-unreachable", "local-openai");
    renderView({
      readiness,
      productLabel: LOCAL_OPENAI_CONFIGURATION.productId,
      primaryLabel: getReadinessActionLabel(readiness.action),
    });

    expect(screen.getByText(/Configuration Not Ready \(local-openai\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test readiness" })).toBeInTheDocument();
    expect(readinessUsesTransportNeutralCopy(readiness)).toBe(true);
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument();
  });

  it("routes CLI unsupported readiness to the inspect action without API-key copy", () => {
    const readiness = makeReadiness("unsupported", "codex-cli");
    renderView({
      readiness,
      productLabel: CLI_UNSUPPORTED_CONFIGURATION.productId,
      primaryLabel: getReadinessActionLabel(readiness.action),
    });

    expect(screen.getByRole("button", { name: "Inspect configuration" })).toBeInTheDocument();
    expect(screen.getByText(/not supported in the current environment/i)).toBeInTheDocument();
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument();
  });

  it("routes removed readiness to the delete action", () => {
    const readiness = makeReadiness("removed", REMOVED_PRODUCT_ID);
    renderView({
      readiness,
      productLabel: REMOVED_ZAI_CODING_CONFIGURATION.productId,
      primaryLabel: getReadinessActionLabel(readiness.action),
    });

    expect(screen.getByRole("button", { name: "Delete configuration" })).toBeInTheDocument();
    expect(screen.getByText(/removed and cannot run reviews/i)).toBeInTheDocument();
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

describe("ReviewTerminalReceiptView", () => {
  it("reports usage unavailable with shared presentation copy", () => {
    render(
      <KeyboardProvider>
        <FooterProvider>
          <ReviewTerminalReceiptView
            outcome="cancelled"
            usageAvailability="unavailable"
            onBack={() => {}}
          />
        </FooterProvider>
      </KeyboardProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Review Cancelled");
    expect(
      screen.getByText(/Usage unavailable: Usage reporting is not available/i),
    ).toBeInTheDocument();
  });

  it("offers a single way home", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <KeyboardProvider>
        <FooterProvider>
          <ReviewTerminalReceiptView outcome="cancelled" onBack={onBack} />
        </FooterProvider>
      </KeyboardProvider>,
    );

    expect(screen.getAllByRole("button", { name: "Back to Home" })).toHaveLength(1);

    await user.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("exposes no secret values in the rendered receipt DOM", () => {
    const { container } = render(
      <KeyboardProvider>
        <FooterProvider>
          <ReviewTerminalReceiptView
            outcome="transport-failed"
            usageAvailability="required-missing"
            onBack={() => {}}
          />
        </FooterProvider>
      </KeyboardProvider>,
    );

    expect(container.textContent).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/i);
    expect(container.textContent).not.toMatch(/Bearer\s+/i);
    expect(container.textContent).not.toMatch(/\/Users\//);
  });
});

describe("ReviewTerminalErrorView", () => {
  it("offers a single way home", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <KeyboardProvider>
        <FooterProvider>
          <ReviewTerminalErrorView message="The provider dropped the connection." onBack={onBack} />
        </FooterProvider>
      </KeyboardProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Review failed");
    expect(screen.getAllByRole("button", { name: "Back to Home" })).toHaveLength(1);

    await user.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
