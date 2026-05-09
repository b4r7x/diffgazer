import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import type { ReactNode } from "react";

const { mockNavigate, mockRetryServer, mockRefetchContext, mockHandleRefreshContext } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRetryServer: vi.fn(),
  mockRefetchContext: vi.fn(),
  mockHandleRefreshContext: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/use-page-footer", () => ({
  usePageFooter: () => {},
}));

vi.mock("@/app/providers/config-provider", () => ({
  useConfigData: () => ({
    provider: "openrouter",
    model: "openrouter/test-model",
    setupStatus: { isReady: true, missing: [] },
  }),
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useDiagnosticsData: () => ({
    serverState: { status: "connected" as const },
    retryServer: mockRetryServer,
    setupStatus: { isReady: true, missing: [] },
    initLoading: false,
    initError: null,
    contextStatus: "ready" as const,
    contextGeneratedAt: "2026-02-09T12:00:00.000Z",
    contextError: null,
    canRegenerate: true,
    handleRefreshContext: mockHandleRefreshContext,
    isRefreshingContext: false,
    refetchContext: mockRefetchContext,
  }),
}));

import { DiagnosticsPage } from "./page";
import { useDiagnosticsKeyboard } from "../../hooks/use-diagnostics-keyboard";

function renderPage() {
  return render(
    <KeyboardProvider>
      <DiagnosticsPage />
    </KeyboardProvider>,
  );
}

function KeyboardWrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

describe("DiagnosticsPage keyboard footer navigation", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRetryServer.mockReset();
    mockRefetchContext.mockReset();
    mockHandleRefreshContext.mockClear();
    mockRetryServer.mockResolvedValue(undefined);
    mockRefetchContext.mockResolvedValue(undefined);
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

  it("ignores overlapping refresh-all calls while refresh is pending", async () => {
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

    const diagnostics = {
      serverState: { status: "connected" as const },
      retryServer: mockRetryServer,
      setupStatus: { isReady: true, missing: [] },
      initLoading: false,
      initError: null,
      contextStatus: "ready" as const,
      contextGeneratedAt: "2026-02-09T12:00:00.000Z",
      contextError: null,
      canRegenerate: true,
      handleRefreshContext: mockHandleRefreshContext,
      isRefreshingContext: false,
      refetchContext: mockRefetchContext,
    };
    const { result } = renderHook(
      () => useDiagnosticsKeyboard({ diagnostics }),
      { wrapper: KeyboardWrapper },
    );

    let refreshPromise: Promise<void> | null = null;
    await act(async () => {
      refreshPromise = result.current.handleRefreshAll();
      void result.current.handleRefreshAll();
      await Promise.resolve();
    });

    expect(mockRetryServer).toHaveBeenCalledTimes(1);
    expect(mockRefetchContext).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshingAll).toBe(true);

    await act(async () => {
      resolveRetry?.();
      resolveContext?.();
      await refreshPromise;
    });

    expect(result.current.isRefreshingAll).toBe(false);
  });

  it("reports refresh-all failures", async () => {
    mockRetryServer.mockRejectedValue(new Error("server down"));
    mockRefetchContext.mockResolvedValue(undefined);

    const diagnostics = {
      serverState: { status: "connected" as const },
      retryServer: mockRetryServer,
      setupStatus: { isReady: true, missing: [] },
      initLoading: false,
      initError: null,
      contextStatus: "ready" as const,
      contextGeneratedAt: "2026-02-09T12:00:00.000Z",
      contextError: null,
      canRegenerate: true,
      handleRefreshContext: mockHandleRefreshContext,
      isRefreshingContext: false,
      refetchContext: mockRefetchContext,
    };
    const { result } = renderHook(
      () => useDiagnosticsKeyboard({ diagnostics }),
      { wrapper: KeyboardWrapper },
    );

    await act(async () => {
      await result.current.handleRefreshAll();
    });

    expect(result.current.refreshError).toBe("Refresh failed for some diagnostics sources.");
  });
});
