import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

const mockNavigate = vi.fn();

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

import { SettingsDiagnosticsPage } from "./page";

function makeInitResponse(
  overrides: Partial<Awaited<ReturnType<BoundApi["loadInit"]>>> = {},
): Awaited<ReturnType<BoundApi["loadInit"]>> {
  return {
    configPath: "/tmp/diffgazer/config.json",
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
    ...overrides,
  };
}

function makeContextResponse(): Awaited<ReturnType<BoundApi["getReviewContext"]>> {
  const generatedAt = "2026-02-09T12:00:00.000Z";

  return {
    text: "stub-context",
    markdown: "stub-context",
    graph: {
      generatedAt,
      root: "/tmp/repo",
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
    },
    meta: {
      generatedAt,
      root: "/tmp/repo",
      statusHash: "status-hash",
      statusHashKind: "full",
      charCount: 12,
    },
  };
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

  const renderResult = render(<SettingsDiagnosticsPage />, { wrapper: Wrapper });
  return { ...renderResult, queryClient };
}

async function waitForReady() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
  });
}

function getOverallStatus() {
  return within(screen.getByRole("region", { name: /system diagnostics/i })).getByRole("status");
}

async function waitForDiagnosticsActions() {
  await waitForReady();
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toHaveFocus();
  });
}

describe("SettingsDiagnosticsPage keyboard footer navigation", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRequest = vi.fn<BoundApi["request"]>().mockResolvedValue(new Response(null));
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

  it("activates diagnostics actions from the visible action row", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiagnosticsActions();

    const initialHealthCalls = mockRequest.mock.calls.length;
    const initialContextCalls = mockGetReviewContext.mock.calls.length;
    const refreshButton = screen.getByRole("button", { name: "Refresh Diagnostics" });
    const regenerateButton = screen.getByRole("button", { name: "Regenerate Context" });
    const actionGroup = screen.getByRole("group", { name: "Diagnostics actions" });

    expect(within(actionGroup).getByRole("button", { name: "Refresh Diagnostics" })).toBeVisible();
    expect(within(actionGroup).getByRole("button", { name: "Regenerate Context" })).toBeVisible();

    await user.click(regenerateButton);

    await waitFor(() => {
      expect(mockRefreshReviewContext).toHaveBeenCalledWith({ force: true });
    });

    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockRequest.mock.calls.length).toBeGreaterThan(initialHealthCalls);
      expect(mockGetReviewContext.mock.calls.length).toBeGreaterThan(initialContextCalls);
    });
  });

  it("keeps diagnostics actions active after ArrowUp because there is no content zone", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiagnosticsActions();

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

    resolveHealth?.(new Response(null));
    resolveContext?.(makeContextResponse());

    await waitFor(() => {
      expect(diagnosticsPanel).toHaveAttribute("aria-busy", "false");
      expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
    });
  });

  it("shows diagnostics presentation labels instead of raw state values", async () => {
    renderPage();
    await waitForReady();

    const diagnosticsPanel = screen.getByRole("region", { name: /system diagnostics/i });

    await waitFor(() => {
      expect(within(diagnosticsPanel).getAllByText("Ready").length).toBeGreaterThan(0);
    });
    expect(within(diagnosticsPanel).queryByText("[ready]")).not.toBeInTheDocument();
    expect(within(diagnosticsPanel).queryByText("success")).not.toBeInTheDocument();
  });

  it("keeps error, loading, setup-needed, and ready precedence across source transitions", async () => {
    const healthRecovery = createDeferred<Awaited<ReturnType<BoundApi["request"]>>>();
    const init = createDeferred<Awaited<ReturnType<BoundApi["loadInit"]>>>();
    const context = createDeferred<Awaited<ReturnType<BoundApi["getReviewContext"]>>>();
    mockRequest
      .mockRejectedValueOnce(new Error("server down"))
      .mockReturnValueOnce(healthRecovery.promise);
    mockLoadInit.mockReturnValueOnce(init.promise);
    mockGetReviewContext.mockReturnValueOnce(context.promise);
    const { queryClient } = renderPage();

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Needs attention"));

    const healthRefetch = queryClient.refetchQueries({ queryKey: ["server", "health"] });
    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Checking"));
    healthRecovery.resolve(new Response(null));
    await healthRefetch;

    init.resolve(
      makeInitResponse({
        config: null,
        setup: {
          hasSecretsStorage: true,
          hasProvider: false,
          hasModel: false,
          hasTrust: true,
          isConfigured: false,
          isReady: false,
          missing: ["provider", "model"],
        },
      }),
    );
    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Checking"));

    context.reject(Object.assign(new Error("context missing"), { status: 404 }));
    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Setup needed"));

    mockLoadInit.mockResolvedValue(makeInitResponse());
    mockGetReviewContext.mockResolvedValue(makeContextResponse());
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["config", "init"] }),
      queryClient.refetchQueries({ queryKey: ["review", "context"] }),
    ]);

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Ready"));
  });

  it("reports an init failure as the overall error when other sources are ready", async () => {
    mockLoadInit.mockReset().mockRejectedValue(new Error("init failed"));
    renderPage();

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Needs attention"));
    expect(screen.getByText("Error: init failed")).toBeVisible();
  });

  it("reports a context failure as the overall error when other sources are ready", async () => {
    mockGetReviewContext.mockReset().mockRejectedValue(new Error("context failed"));
    renderPage();

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Needs attention"));
    expect(screen.getByText("Error: context failed")).toBeVisible();
  });

  it("reports incomplete setup even when context is ready", async () => {
    mockLoadInit.mockReset().mockResolvedValue(
      makeInitResponse({
        config: null,
        setup: {
          hasSecretsStorage: true,
          hasProvider: false,
          hasModel: false,
          hasTrust: true,
          isConfigured: false,
          isReady: false,
          missing: ["provider", "model"],
        },
      }),
    );
    renderPage();

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Setup needed"));
  });

  it("reports missing context even when configured setup is ready", async () => {
    mockGetReviewContext
      .mockReset()
      .mockRejectedValue(Object.assign(new Error("context missing"), { status: 404 }));
    renderPage();

    await waitFor(() => expect(getOverallStatus()).toHaveTextContent("Setup needed"));
  });

  it("shows the failed source error after refresh-all", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForReady();

    // Next health refetch fails.
    mockRequest.mockRejectedValueOnce(new Error("server down"));

    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    expect(await screen.findByText("Error: server down")).toBeVisible();
    expect(screen.getByText("server down")).toBeVisible();
    expect(await screen.findByText("Needs attention")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
  });

  it("does not resurrect a recovered refresh error when another source later fails", async () => {
    const user = userEvent.setup();
    const missingContext = Object.assign(new Error("context missing"), { status: 404 });
    mockGetReviewContext
      .mockReset()
      .mockRejectedValueOnce(missingContext)
      .mockRejectedValueOnce(missingContext)
      .mockResolvedValue(makeContextResponse());
    renderPage();
    await waitForReady();

    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));
    expect(await screen.findByText("context missing")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Generate Context" }));
    await waitFor(() => expect(mockRefreshReviewContext).toHaveBeenCalledWith({ force: true }));

    await waitFor(() => {
      expect(screen.queryByText("context missing")).not.toBeInTheDocument();
    });
    expect(getOverallStatus()).toHaveTextContent("Ready");

    mockRequest.mockRejectedValueOnce(new Error("later server failure"));
    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    expect(await screen.findByText("later server failure")).toBeVisible();
    expect(screen.queryByText("context missing")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Refresh failed for some diagnostics sources."),
    ).not.toBeInTheDocument();
  });

  it("clears a context-generation error after refresh-all refetches context successfully", async () => {
    const user = userEvent.setup();
    mockRefreshReviewContext.mockRejectedValueOnce(new Error("context generation failed"));
    renderPage();
    await waitForReady();

    await user.click(await screen.findByRole("button", { name: "Regenerate Context" }));
    expect(await screen.findByText("context generation failed")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    await waitFor(() => {
      expect(screen.queryByText("context generation failed")).not.toBeInTheDocument();
    });
    expect(getOverallStatus()).toHaveTextContent("Ready");
  });

  it("updates Health when a later health poll recovers after a failed refresh", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();
    await waitForReady();

    mockRequest.mockRejectedValueOnce(new Error("server down"));
    await user.click(screen.getByRole("button", { name: "Refresh Diagnostics" }));

    const diagnosticsPanel = screen.getByRole("region", { name: /system diagnostics/i });
    await waitFor(() => {
      expect(within(diagnosticsPanel).getByText("Error: server down")).toBeVisible();
      expect(within(diagnosticsPanel).getByText("Needs attention")).toBeVisible();
    });

    mockRequest.mockResolvedValueOnce(new Response(null));
    await queryClient.refetchQueries({ queryKey: ["server", "health"] });

    await waitFor(() => {
      expect(within(diagnosticsPanel).getByText("Connected")).toBeVisible();
      expect(within(diagnosticsPanel).queryByText("Needs attention")).not.toBeInTheDocument();
      expect(within(diagnosticsPanel).queryByText("server down")).not.toBeInTheDocument();
    });
  });
});
