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
import { makeShellApiOverrides, makeShellInitResponse } from "@/testing/shell-fixtures";

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

import { GlobalLayout, getWordmarkTier } from "./global";

let queryClient: QueryClient;
let mockApi: BoundApi;
const shellInit = makeShellInitResponse();

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

  it("keeps focus with the active widget when a click lands on dead space in main", async () => {
    const user = userEvent.setup();
    renderShell(
      <>
        <div role="listbox" tabIndex={0} aria-label="Runs" />
        <p>Static pane text</p>
      </>,
    );
    const listbox = screen.getByRole("listbox", { name: "Runs" });

    listbox.focus();
    await user.click(screen.getByText("Static pane text"));

    expect(listbox).toHaveFocus();
  });

  it("keeps focus with the active widget when a click lands on prose inside a pane focus park", async () => {
    const user = userEvent.setup();
    renderShell(
      // Panes park programmatic focus on a tabIndex={-1} wrapper around their
      // prose so focus survives a control disappearing; pressing that prose is
      // still a dead-space press.
      <>
        <div role="listbox" tabIndex={0} aria-label="Runs" />
        <div tabIndex={-1}>
          <p>Static pane text</p>
        </div>
      </>,
    );
    const listbox = screen.getByRole("listbox", { name: "Runs" });

    listbox.focus();
    await user.click(screen.getByText("Static pane text"));

    expect(listbox).toHaveFocus();
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

  it("carries the banner wordmark in the shell header on home", () => {
    routerState.pathname = "/";

    renderShell();

    expect(screen.getByRole("img", { name: "diffgazer" })).toBeInTheDocument();
  });

  it("opens the setup wizard with the banner wordmark", () => {
    routerState.pathname = "/onboarding";

    renderShell();

    expect(screen.getByRole("img", { name: "diffgazer" })).toBeInTheDocument();
  });

  it("renders the ascii wordmark, never a plain-text one, on a work screen", () => {
    routerState.pathname = "/history";

    renderShell();

    expect(screen.getAllByRole("img", { name: "diffgazer" })).toHaveLength(1);
    expect(screen.queryByText("DIFFGAZER")).not.toBeInTheDocument();
  });

  it("keeps the configured header when configuration init succeeds", async () => {
    renderShell();

    const status = await screen.findByLabelText(
      "Provider: Google Gemini / Gemini 2.5 Flash, Ready; server live",
    );
    expect(status).toHaveTextContent("Google Gemini / Gemini 2.5 Flash");
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

describe("getWordmarkTier", () => {
  // Every path in app/router.tsx, plus an unmatched one standing in for the 404.
  // The settings hub and all of its children share one tier: the wordmark must
  // never change size while navigating within the settings flow.
  it.each([
    ["/", "hero"],
    ["/settings", "hero"],
    ["/help", "hero"],
    ["/onboarding", "hero"],
    ["/settings/theme", "hero"],
    ["/settings/providers", "hero"],
    ["/settings/storage", "hero"],
    ["/settings/agent-execution", "hero"],
    ["/settings/analysis", "hero"],
    ["/settings/diagnostics", "hero"],
    ["/settings/trust-permissions", "hero"],
    ["/review/2f1b0d6e-6a0e-4a3a-9a1e-2b0c4d5e6f70", "dense"],
    ["/history", "dense"],
    ["/no-such-route", "dense"],
  ])("gives %s the %s wordmark tier", (pathname, tier) => {
    expect(getWordmarkTier(pathname)).toBe(tier);
  });
});
