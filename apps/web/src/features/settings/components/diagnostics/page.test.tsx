import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import { FooterProvider } from "@/components/layout";
import type { DiagnosticsData } from "@diffgazer/core/api/hooks";

const {
  mockNavigate,
  mockRetryServer,
  mockRefetchContext,
  mockHandleRefreshContext,
  mockDiagnosticsData,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRetryServer: vi.fn(),
  mockRefetchContext: vi.fn(),
  mockHandleRefreshContext: vi.fn(),
  mockDiagnosticsData: { current: undefined as DiagnosticsData | undefined },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/app/providers/config-provider", () => ({
  useConfigData: () => ({
    provider: "openrouter",
    model: "openrouter/test-model",
    setupStatus: { isReady: true, missing: [] },
  }),
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useDiagnosticsData: () => mockDiagnosticsData.current,
}));

import { DiagnosticsPage } from "./page";

function renderPage() {
  return render(
    <FooterProvider>
      <KeyboardProvider>
        <DiagnosticsPage />
      </KeyboardProvider>
    </FooterProvider>,
  );
}

function makeDiagnostics(overrides: Partial<DiagnosticsData> = {}): DiagnosticsData {
  return {
    serverState: { status: "connected" },
    retryServer: mockRetryServer,
    setupStatus: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: true,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
    initLoading: false,
    initError: null,
    contextStatus: "ready",
    contextGeneratedAt: "2026-02-09T12:00:00.000Z",
    contextError: null,
    canRegenerate: true,
    handleRefreshContext: mockHandleRefreshContext,
    isRefreshingContext: false,
    refetchContext: mockRefetchContext,
    ...overrides,
  };
}

describe("DiagnosticsPage keyboard footer navigation", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRetryServer.mockReset();
    mockRefetchContext.mockReset();
    mockHandleRefreshContext.mockClear();
    mockRetryServer.mockResolvedValue(undefined);
    mockRefetchContext.mockResolvedValue(undefined);
    mockDiagnosticsData.current = makeDiagnostics();
  });

  it("activates diagnostics actions selected with left/right arrows", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.keyboard("{ArrowRight}{Enter}");
    expect(mockHandleRefreshContext).toHaveBeenCalledOnce();

    await user.keyboard("{ArrowLeft}{Enter}");

    await waitFor(() => {
      expect(mockRetryServer).toHaveBeenCalledOnce();
      expect(mockRefetchContext).toHaveBeenCalledOnce();
    });
  });

  it("keeps diagnostics actions active after ArrowUp because there is no content zone", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.keyboard("{ArrowUp}{Enter}");

    await waitFor(() => {
      expect(mockRetryServer).toHaveBeenCalledOnce();
      expect(mockRefetchContext).toHaveBeenCalledOnce();
    });
  });

  it("shows refresh progress and blocks overlapping refresh-all actions", async () => {
    const user = userEvent.setup();
    let resolveRetry: (() => void) | null = null;
    let resolveContext: (() => void) | null = null;
    mockRetryServer.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveRetry = resolve;
      }),
    );
    mockRefetchContext.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveContext = resolve;
      }),
    );

    renderPage();

    const diagnosticsPanel = screen.getByRole("region", { name: /system diagnostics/i });
    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    await waitFor(() => {
      expect(diagnosticsPanel).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("button", { name: "Refreshing..." })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Refreshing..." })).not.toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Refreshing..." }));
    await user.keyboard("r");

    expect(mockRetryServer).toHaveBeenCalledTimes(1);
    expect(mockRefetchContext).toHaveBeenCalledTimes(1);

    resolveRetry?.();
    resolveContext?.();

    await waitFor(() => {
      expect(diagnosticsPanel).toHaveAttribute("aria-busy", "false");
      expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
    });
  });

  it("shows refresh-all failures in the diagnostics page", async () => {
    const user = userEvent.setup();
    mockRetryServer.mockRejectedValue(new Error("server down"));
    mockRefetchContext.mockResolvedValue(undefined);

    renderPage();

    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    expect(await screen.findByText("Refresh failed for some diagnostics sources.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
  });
});
