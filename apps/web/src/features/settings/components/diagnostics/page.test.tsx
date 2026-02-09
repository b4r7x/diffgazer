import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KeyboardProvider } from "@diffgazer/keyboard";

const { mockNavigate, mockRetry, mockReloadContextStatus, mockHandleRefreshContext } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRetry: vi.fn().mockResolvedValue(undefined),
  mockReloadContextStatus: vi.fn().mockResolvedValue(undefined),
  mockHandleRefreshContext: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/use-page-footer", () => ({
  usePageFooter: () => {},
}));

vi.mock("@/hooks/use-server-status", () => ({
  useServerStatus: () => ({
    state: { status: "connected", message: "" },
    retry: mockRetry,
  }),
}));

vi.mock("@/app/providers/config-provider", () => ({
  useConfigData: () => ({
    provider: "openrouter",
    model: "openrouter/test-model",
    setupStatus: { isReady: true, missing: [] },
  }),
}));

vi.mock("@/features/settings/hooks/use-context-management", () => ({
  useContextManagement: () => ({
    contextStatus: "ready",
    contextGeneratedAt: "2026-02-09T12:00:00.000Z",
    isRefreshing: false,
    error: null,
    reloadContextStatus: mockReloadContextStatus,
    handleRefreshContext: mockHandleRefreshContext,
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
    mockRetry.mockClear();
    mockReloadContextStatus.mockClear();
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
