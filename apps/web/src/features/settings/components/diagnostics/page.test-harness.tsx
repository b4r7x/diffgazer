import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderResult, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { SettingsDiagnosticsPage } from "./page";

export const mockNavigate: Mock = vi.fn();

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

export function makeInitResponse(
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

export function makeContextResponse(): Awaited<ReturnType<BoundApi["getReviewContext"]>> {
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

export let mockRequest: Mock<BoundApi["request"]>;
export let mockLoadInit: Mock<BoundApi["loadInit"]>;
export let mockGetProviderStatus: Mock<BoundApi["getProviderStatus"]>;
export let mockGetReviewContext: Mock<BoundApi["getReviewContext"]>;
export let mockRefreshReviewContext: Mock<BoundApi["refreshReviewContext"]>;

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

export function setupDiagnosticsMocks() {
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
}

export function renderPage(): RenderResult & { queryClient: QueryClient } {
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

export async function waitForReady() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toBeEnabled();
  });
}

export function getOverallStatus() {
  return within(screen.getByRole("region", { name: /system diagnostics/i })).getByRole("status");
}

export async function waitForDiagnosticsActions() {
  await waitForReady();
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Refresh Diagnostics" })).toHaveFocus();
  });
}
