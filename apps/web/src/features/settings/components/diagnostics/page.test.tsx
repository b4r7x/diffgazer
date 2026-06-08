import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

const mockNavigate = vi.fn();

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

import { DiagnosticsPage } from "./page";

function makeInitResponse(): Awaited<ReturnType<BoundApi["loadInit"]>> {
  return {
    config: { provider: "openrouter", model: "openrouter/test-model" },
    providers: [{ provider: "openrouter", hasApiKey: true, isActive: true }],
    settings: {
      theme: "terminal",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: null,
      agentExecution: "parallel",
    },
    configured: true,
    project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: true,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
  };
}

function makeContextResponse(): Awaited<ReturnType<BoundApi["getReviewContext"]>> {
  return {
    meta: { generatedAt: "2026-02-09T12:00:00.000Z" },
    context: "stub-context",
  } as unknown as Awaited<ReturnType<BoundApi["getReviewContext"]>>;
}

let mockRequest: Mock<BoundApi["request"]>;
let mockLoadInit: Mock<BoundApi["loadInit"]>;
let mockGetProviderStatus: Mock<BoundApi["getProviderStatus"]>;
let mockGetReviewContext: Mock<BoundApi["getReviewContext"]>;
let mockRefreshReviewContext: Mock<BoundApi["refreshReviewContext"]>;

function createTestApi(): BoundApi {
  const baseApi = createApi({ baseUrl: "http://localhost" });
  return {
    ...baseApi,
    request: mockRequest,
    loadInit: mockLoadInit,
    getProviderStatus: mockGetProviderStatus,
    getReviewContext: mockGetReviewContext,
    refreshReviewContext: mockRefreshReviewContext,
  } satisfies BoundApi;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const api = createTestApi();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <FooterProvider>
              <KeyboardProvider>{children}</KeyboardProvider>
            </FooterProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  }

  return render(<DiagnosticsPage />, { wrapper: Wrapper });
}

async function waitForReady() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
  });
}

describe("DiagnosticsPage keyboard footer navigation", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRequest = vi
      .fn<BoundApi["request"]>()
      .mockResolvedValue({ ok: true } as unknown as Response);
    mockLoadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse());
    mockGetProviderStatus = vi
      .fn<BoundApi["getProviderStatus"]>()
      .mockResolvedValue([{ provider: "openrouter", hasApiKey: true, isActive: true }]);
    mockGetReviewContext = vi
      .fn<BoundApi["getReviewContext"]>()
      .mockResolvedValue(makeContextResponse());
    mockRefreshReviewContext = vi
      .fn<BoundApi["refreshReviewContext"]>()
      .mockResolvedValue(makeContextResponse());
  });

  it("activates diagnostics actions selected with left/right arrows", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForReady();

    const initialHealthCalls = mockRequest.mock.calls.length;
    const initialContextCalls = mockGetReviewContext.mock.calls.length;

    await user.keyboard("{ArrowRight}{Enter}");
    await waitFor(() => {
      expect(mockRefreshReviewContext).toHaveBeenCalledWith({ force: true });
    });

    await user.keyboard("{ArrowLeft}{Enter}");

    await waitFor(() => {
      expect(mockRequest.mock.calls.length).toBeGreaterThan(initialHealthCalls);
      expect(mockGetReviewContext.mock.calls.length).toBeGreaterThan(initialContextCalls);
    });
  });

  it("keeps diagnostics actions active after ArrowUp because there is no content zone", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForReady();

    const initialHealthCalls = mockRequest.mock.calls.length;
    const initialContextCalls = mockGetReviewContext.mock.calls.length;

    await user.keyboard("{ArrowUp}{Enter}");

    await waitFor(() => {
      expect(mockRequest.mock.calls.length).toBeGreaterThan(initialHealthCalls);
      expect(mockGetReviewContext.mock.calls.length).toBeGreaterThan(initialContextCalls);
    });
  });

  it("shows refresh progress and blocks overlapping refresh-all actions", async () => {
    const user = userEvent.setup();
    let resolveHealth: ((value: Awaited<ReturnType<BoundApi["request"]>>) => void) | undefined;
    let resolveContext:
      | ((value: Awaited<ReturnType<BoundApi["getReviewContext"]>>) => void)
      | undefined;

    renderPage();
    await waitForReady();

    // Capture initial call counts; the next refetches are the ones the test holds.
    const initialHealthCalls = mockRequest.mock.calls.length;
    const initialContextCalls = mockGetReviewContext.mock.calls.length;

    // Stub the next refetches to block until we resolve.
    mockRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHealth = resolve;
        }),
    );
    mockGetReviewContext.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveContext = resolve;
        }),
    );

    const diagnosticsPanel = screen.getByRole("region", { name: /system diagnostics/i });
    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    await waitFor(() => {
      expect(diagnosticsPanel).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("button", { name: "Refreshing..." })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Refreshing..." })).not.toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Refreshing..." }));
    await user.keyboard("r");

    // No additional refetches issued while refresh-all is in-flight.
    expect(mockRequest.mock.calls.length).toBe(initialHealthCalls + 1);
    expect(mockGetReviewContext.mock.calls.length).toBe(initialContextCalls + 1);

    resolveHealth?.({ ok: true } as unknown as Response);
    resolveContext?.(makeContextResponse());

    await waitFor(() => {
      expect(diagnosticsPanel).toHaveAttribute("aria-busy", "false");
      expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
    });
  });

  it("shows refresh-all failures in the diagnostics page", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForReady();

    // Next health refetch fails.
    mockRequest.mockRejectedValueOnce(new Error("server down"));

    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    expect(await screen.findByText("Refresh failed for some diagnostics sources.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
  });
});
