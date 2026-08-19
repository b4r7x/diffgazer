import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ConfigurationInitResponse } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderResult, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import {
  makeShellApiOverrides,
  makeShellInitResponse,
  SHELL_TRUSTED_PROJECT,
} from "@/testing/shell-fixtures";
import { SettingsDiagnosticsPage } from "../components/diagnostics/page";

export const mockNavigate: Mock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

export function makeInitResponse(overrides: Partial<ConfigurationInitResponse> = {}) {
  return makeShellInitResponse(overrides);
}

export function makeUnconfiguredInitResponse(): ConfigurationInitResponse {
  return makeShellInitResponse({
    configurations: [],
    selectedConfigurationId: null,
    project: SHELL_TRUSTED_PROJECT,
    settings: {
      theme: "terminal",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: "file",
      agentExecution: "parallel",
      providerConsent: null,
    },
  });
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
export let mockGetReviewContext: Mock<BoundApi["getReviewContext"]>;
export let mockRefreshReviewContext: Mock<BoundApi["refreshReviewContext"]>;
export let mockLoadInit: Mock<BoundApi["loadConfigurationInit"]>;
let shellApiOverrides: Partial<BoundApi>;

function createTestApi(): BoundApi {
  const baseApi = createApi({ baseUrl: "http://localhost" });
  return {
    ...baseApi,
    request: mockRequest,
    ...shellApiOverrides,
    loadConfigurationInit: mockLoadInit,
    getReviewContext: mockGetReviewContext,
    refreshReviewContext: mockRefreshReviewContext,
  } satisfies BoundApi;
}

export function setupDiagnosticsMocks() {
  mockNavigate.mockReset();
  mockRequest = vi.fn<BoundApi["request"]>().mockResolvedValue(new Response(null));
  mockGetReviewContext = vi
    .fn<BoundApi["getReviewContext"]>()
    .mockResolvedValue(makeContextResponse());
  mockRefreshReviewContext = vi
    .fn<BoundApi["refreshReviewContext"]>()
    .mockResolvedValue(makeContextResponse());
  shellApiOverrides = makeShellApiOverrides(makeInitResponse());
  mockLoadInit = shellApiOverrides.loadConfigurationInit as Mock<BoundApi["loadConfigurationInit"]>;
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
