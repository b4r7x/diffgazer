import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KeyboardProvider } from "keyscope";

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

vi.mock("@diffgazer/api/hooks", () => ({
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

function renderPage() {
  return render(
    <KeyboardProvider>
      <DiagnosticsPage />
    </KeyboardProvider>,
  );
}

describe("DiagnosticsPage keyboard footer navigation", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRetryServer.mockClear();
    mockRefetchContext.mockClear();
    mockHandleRefreshContext.mockClear();
  });

  it("moves focus between diagnostics action buttons with left/right arrows", async () => {
    renderPage();

    const refreshButton = screen.getByRole("button", { name: /refresh diagnostics/i });
    const regenerateButton = screen.getByRole("button", { name: /regenerate context/i });

    await waitFor(() => {
      expect(refreshButton.className.includes("ring-tui-blue")).toBe(true);
    });

    fireEvent.keyDown(window, { key: "ArrowRight" });

    await waitFor(() => {
      expect(regenerateButton.className.includes("ring-tui-green")).toBe(true);
    });

    fireEvent.keyDown(window, { key: "ArrowLeft" });

    await waitFor(() => {
      expect(refreshButton.className.includes("ring-tui-blue")).toBe(true);
    });
  });
});
