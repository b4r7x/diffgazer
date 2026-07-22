import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

// Boundary mock: Router is the routing library; the shell reads location/back state.
const { navigateSpy, backSpy, routerState } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  backSpy: vi.fn(),
  routerState: { pathname: "/", canGoBack: false },
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ history: { back: backSpy }, navigate: navigateSpy }),
  useNavigate: () => navigateSpy,
  useLocation: () => ({ pathname: routerState.pathname }),
  useCanGoBack: () => routerState.canGoBack,
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
  navigateSpy.mockClear();
  backSpy.mockClear();
  routerState.pathname = "/";
  routerState.canGoBack = false;
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
            <KeyboardProvider>
              <GlobalLayout>{children}</GlobalLayout>
            </KeyboardProvider>
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

  it("moves focus to main on skip activation without adding main to regular Tab order", async () => {
    const user = userEvent.setup();
    renderShell(<button type="button">First content action</button>);
    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const main = screen.getByRole("main");

    await user.click(skipLink);
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute("tabindex", "-1");

    skipLink.focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "First content action" })).toHaveFocus();
  });

  it("navigates to the settings route without calling history back on a settings subroute", async () => {
    const user = userEvent.setup();
    routerState.pathname = "/settings/theme";
    routerState.canGoBack = true;

    renderShell();
    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(navigateSpy).toHaveBeenCalledWith({ to: "/settings" });
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("calls history back without navigating on a non-settings route with history", async () => {
    const user = userEvent.setup();
    routerState.pathname = "/history";
    routerState.canGoBack = true;

    renderShell();
    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(backSpy).toHaveBeenCalledOnce();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("keeps the configured header when only provider status fails", async () => {
    vi.mocked(mockApi.getProviderStatus).mockRejectedValue(
      new Error("provider status unavailable"),
    );

    renderShell();

    expect(
      await screen.findByLabelText("Provider: openrouter / openrouter/test-model, Status: active"),
    ).toBeInTheDocument();
  });

  it("labels an init failure without presenting an unconfigured provider", async () => {
    vi.mocked(mockApi.loadInit).mockRejectedValue(new Error("init unavailable"));

    renderShell();

    expect(
      await screen.findByLabelText("Provider: Configuration unavailable, Status: idle"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Provider: Not configured/i)).not.toBeInTheDocument();
  });
});
