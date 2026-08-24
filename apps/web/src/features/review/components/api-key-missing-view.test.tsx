import { FooterProvider } from "@diffgazer/core/footer";
import { CONFIGURATION_ERROR_COPY, CONFIGURE_PROVIDER_LABEL } from "@diffgazer/core/review";
import {
  CODEX_CLI_CONFIGURATION,
  LOCAL_OPENAI_CONFIGURATION,
  makeReadiness,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ApiKeyMissingView,
  type ApiKeyMissingViewProps,
  ConfigurationErrorView,
  ReviewStartErrorView,
  ReviewTerminalReceiptView,
} from "./api-key-missing-view";

type RenderViewProps = Pick<ApiKeyMissingViewProps, "readiness"> &
  Partial<Omit<ApiKeyMissingViewProps, "readiness">>;

function renderView(props: RenderViewProps) {
  const readiness = props.readiness ?? makeReadiness("unconfigured");
  const onBack = props.onBack ?? vi.fn();
  const onNavigateSettings = props.onNavigateSettings ?? vi.fn();
  const primaryLabel = props.primaryLabel ?? CONFIGURE_PROVIDER_LABEL;

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
    renderView({ readiness });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL })).toHaveFocus();
    });
  });

  it("moves focus between actions with ArrowRight/ArrowLeft", async () => {
    const user = userEvent.setup();
    const readiness = makeReadiness("unconfigured");
    renderView({ readiness });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL })).toHaveFocus();
  });

  it("Enter on the focused Back action calls only onBack (regression: no double-fire)", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    const readiness = makeReadiness("unconfigured");
    renderView({
      readiness,
      onBack,
      onNavigateSettings,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL })).toHaveFocus();
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
      onBack,
      onNavigateSettings,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL })).toHaveFocus();
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
      onBack,
      onNavigateSettings,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL })).toHaveFocus();
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
      onBack,
      onNavigateSettings,
      primaryDisabled: true,
    });

    const configure = screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL });
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
    const readiness = makeReadiness("local-conformance-failed", "local-openai");
    renderView({
      readiness,
      productLabel: LOCAL_OPENAI_CONFIGURATION.productId,
    });

    expect(screen.getByText(/Configuration Not Ready \(local-openai\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL })).toBeInTheDocument();
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument();
  });

  it("renders CLI unsupported readiness without API-key copy", () => {
    const readiness = makeReadiness("unsupported", "codex-cli");
    renderView({
      readiness,
      productLabel: CODEX_CLI_CONFIGURATION.productId,
    });

    expect(screen.getByRole("button", { name: CONFIGURE_PROVIDER_LABEL })).toBeInTheDocument();
    expect(screen.getByText(/not supported in the current environment/i)).toBeInTheDocument();
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument();
  });
});

function renderConfigurationError(
  overrides: Partial<ComponentProps<typeof ConfigurationErrorView>> = {},
) {
  const handlers = { onRetry: vi.fn(), onConfigureProvider: vi.fn(), onBack: vi.fn() };

  render(
    <KeyboardProvider>
      <FooterProvider>
        <ConfigurationErrorView {...handlers} {...overrides} />
      </FooterProvider>
    </KeyboardProvider>,
  );

  return handlers;
}

describe("ConfigurationErrorView", () => {
  it("announces the load-failure copy, not the readiness copy, and lets the user retry", async () => {
    const user = userEvent.setup();
    const { onRetry, onConfigureProvider } = renderConfigurationError();

    expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    expect(screen.getByText(CONFIGURATION_ERROR_COPY.body)).toBeInTheDocument();
    expect(screen.queryByText(/Configuration Not Ready/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onConfigureProvider).not.toHaveBeenCalled();
  });

  it("reaches Configure Provider by pointer and by keyboard without firing its neighbors", async () => {
    const user = userEvent.setup();
    const { onRetry, onConfigureProvider, onBack } = renderConfigurationError();

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onConfigureProvider).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Configure Provider" }));

    expect(onConfigureProvider).toHaveBeenCalledTimes(2);
    expect(onRetry).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("keeps Escape on Back to Home, never the recovery action", async () => {
    const user = userEvent.setup();
    const { onBack, onConfigureProvider } = renderConfigurationError();

    await user.keyboard("{Escape}");

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onConfigureProvider).not.toHaveBeenCalled();
  });

  it("disables the forward actions while a transition is pending, keeping Back active", () => {
    renderConfigurationError({ actionsDisabled: true });

    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Configure Provider" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeEnabled();
  });

  it("names the session-token mismatch and offers Retry alone on 401", async () => {
    const user = userEvent.setup();
    const { onRetry, onConfigureProvider } = renderConfigurationError({
      error: Object.assign(new Error("Unauthorized"), { status: 401, code: "UNAUTHORIZED" }),
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Session Not Authorized");
    // Provider setup cannot fix a token mismatch, so the recovery action is dropped.
    expect(screen.queryByRole("button", { name: "Configure Provider" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onConfigureProvider).not.toHaveBeenCalled();
  });

  it("keeps the generic load-failure gate for non-401 errors", () => {
    renderConfigurationError({ error: new Error("credential file corrupt") });

    expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    expect(screen.queryByText("Session Not Authorized")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure Provider" })).toBeInTheDocument();
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

describe("ReviewStartErrorView", () => {
  it("renders the server's start refusal inline and leads with the providers jump", async () => {
    const user = userEvent.setup();
    const onConfigureProvider = vi.fn();
    const onBack = vi.fn();

    render(
      <KeyboardProvider>
        <FooterProvider>
          <ReviewStartErrorView
            startError={{
              title: "Configuration Needs Attention",
              message: "The selected model failed structured output. Select a different model.",
              recovery: "configure-provider",
            }}
            onConfigureProvider={onConfigureProvider}
            onBack={onBack}
          />
        </FooterProvider>
      </KeyboardProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Configuration Needs Attention");
    expect(screen.getByText(/failed structured output/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Providers" }));
    expect(onConfigureProvider).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    "open-active-review",
  ] as const)("offers only the way home when the providers screen cannot fix the start (recovery: %s)", (recovery) => {
    render(
      <KeyboardProvider>
        <FooterProvider>
          <ReviewStartErrorView
            startError={{
              title: "Review Already Running",
              message: "A review is already running for this configuration.",
              recovery,
            }}
            onConfigureProvider={vi.fn()}
            onBack={vi.fn()}
          />
        </FooterProvider>
      </KeyboardProvider>,
    );

    expect(screen.queryByRole("button", { name: "Open Providers" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Back to Home" })).toHaveLength(1);
  });
});
