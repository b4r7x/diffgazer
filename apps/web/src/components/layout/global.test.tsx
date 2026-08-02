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
import {
  makeShellApiOverrides,
  makeShellInitResponse,
  selectedModelLabel,
  selectedProductLabel,
} from "@/testing/shell-fixtures";

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
const shellInit = makeShellInitResponse();

function providerStatusLabel(): string {
  return "Ready";
}

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
    request: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    ...makeShellApiOverrides(shellInit),
  };
}

function expectedProviderLabel(): string {
  const product = selectedProductLabel(shellInit);
  const model = selectedModelLabel(shellInit);
  return model ? `${product} / ${model}` : product;
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

  it("offers no back affordance during onboarding, which has nowhere to go back to", () => {
    routerState.pathname = "/onboarding";
    routerState.canGoBack = true;

    renderShell();

    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });

  it("keeps the figlet banner on home, the one cover screen", () => {
    routerState.pathname = "/";

    renderShell();

    expect(screen.getByRole("img", { name: "diffgazer" })).toBeInTheDocument();
  });

  it("gives the setup wizard the same compact wordmark as every other work screen", () => {
    routerState.pathname = "/onboarding";

    renderShell();

    expect(screen.queryByRole("img", { name: "diffgazer" })).not.toBeInTheDocument();
    expect(screen.getByText("DIFFGAZER")).toBeInTheDocument();
  });

  it("keeps the configured header when configuration init succeeds", async () => {
    renderShell();

    const status = await screen.findByLabelText(
      `Provider: ${expectedProviderLabel()}, ${providerStatusLabel()}; server live`,
    );
    expect(status).toHaveTextContent(expectedProviderLabel());
  });

  it("keeps the shell mounted and names the cause when the server stops answering", async () => {
    const user = userEvent.setup();
    vi.mocked(mockApi.request).mockRejectedValue(new Error("connection refused"));

    renderShell();

    expect(await screen.findByText(/server not responding/i)).toBeVisible();
    expect(screen.getByRole("main")).toHaveTextContent("Help content");
    expect(await screen.findByLabelText(/server offline$/)).toHaveTextContent("Offline");

    vi.mocked(mockApi.request).mockResolvedValue(new Response(null, { status: 200 }));
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByLabelText(/server live$/);
    expect(screen.queryByText(/server not responding/i)).not.toBeInTheDocument();
  });

  it("shows no connection strip while the server answers", async () => {
    renderShell();

    await screen.findByLabelText(/server live$/);
    expect(screen.queryByText(/server not responding/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("labels an init failure without presenting an unconfigured provider", async () => {
    vi.mocked(mockApi.loadConfigurationInit).mockRejectedValue(new Error("init unavailable"));

    renderShell();

    const status = await screen.findByLabelText(
      "Provider: Configuration unavailable, Unavailable; server live",
    );
    expect(status).toHaveTextContent("Configuration unavailable");
    expect(screen.queryByLabelText(/Provider: Not configured/i)).not.toBeInTheDocument();
  });

  it("serializes no secret-bearing provider fields in the rendered shell", async () => {
    const { container } = renderShell();
    await screen.findByLabelText(/server live$/);
    expect(container.innerHTML).toBeClientSafeDom();
  });
});
