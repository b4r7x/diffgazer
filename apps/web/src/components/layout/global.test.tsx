import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

// Boundary mock: Router is the routing library; the shell reads location/back state.
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ history: { back: vi.fn() }, navigate: vi.fn() }),
  useLocation: () => ({ pathname: "/" }),
  useCanGoBack: () => false,
}));

import { GlobalLayout } from "./global";

let queryClient: QueryClient;
let mockApi: BoundApi;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  mockApi = createMockApi();
});

afterEach(() => {
  queryClient.clear();
});

function renderShell(children: ReactNode = <p>Help content</p>) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={mockApi}>
        <ConfigProvider>
          <FooterProvider>
            <GlobalLayout>{children}</GlobalLayout>
          </FooterProvider>
        </ConfigProvider>
      </ApiProvider>
    </QueryClientProvider>,
  );
}

function createMockApi(): BoundApi {
  const api = createApi({ baseUrl: "http://localhost" });

  return {
    ...api,
    activateProvider: vi
      .fn()
      .mockResolvedValue({ provider: "openrouter", model: "openrouter/test-model" }),
    deleteProviderCredentials: vi.fn().mockResolvedValue({ deleted: true }),
    getProviderStatus: vi
      .fn()
      .mockResolvedValue([{ provider: "openrouter", hasApiKey: true, isActive: true }]),
    loadInit: vi.fn().mockResolvedValue({
      config: { provider: "openrouter", model: "openrouter/test-model" },
      configured: true,
      project: { projectId: "proj-1", path: "/repo", trust: null },
      providers: [{ provider: "openrouter", hasApiKey: true, isActive: true }],
      settings: {
        agentExecution: "parallel",
        defaultLenses: [],
        defaultProfile: null,
        secretsStorage: null,
        severityThreshold: "low",
        theme: "terminal",
      },
      setup: {
        hasModel: true,
        hasProvider: true,
        hasSecretsStorage: true,
        hasTrust: false,
        isConfigured: true,
        isReady: true,
        missing: [],
      },
    }),
    saveConfig: vi.fn().mockResolvedValue(undefined),
  };
}

describe("GlobalLayout", () => {
  it("renders the app shell landmarks and skip link around page content", () => {
    renderShell();

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("main")).toHaveTextContent("Help content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
