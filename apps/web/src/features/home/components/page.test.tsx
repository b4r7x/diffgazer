import { FooterProvider } from "@diffgazer/core/footer";
import type { InitResponse, ProviderStatus } from "@diffgazer/core/schemas/config";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

type ActiveSessionState = { reviewId: string; mode: ReviewMode } | null;
type QueryState<T> = { data: T | undefined; error: Error | null; isLoading: boolean };
type ConfigQueriesState = {
  init: QueryState<InitResponse>;
  providers: QueryState<ProviderStatus[]>;
};

const {
  configQueriesState,
  initResponse,
  mockCreateReview,
  mockNavigate,
  mockUseActiveReviewSession,
  providers,
} = vi.hoisted(() => {
  const initResponse = {
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
    project: {
      projectId: "proj-1",
      path: "/repo",
      trust: {
        projectId: "proj-1",
        repoRoot: "/repo",
        trustedAt: "2026-01-01T00:00:00.000Z",
        trustMode: "persistent",
        capabilities: { readFiles: true, runCommands: false },
      },
    },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: true,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
  } satisfies InitResponse;
  const providers = [
    { provider: "openrouter", hasApiKey: true, isActive: true },
  ] satisfies ProviderStatus[];
  const configQueriesState: ConfigQueriesState = {
    init: { data: initResponse, error: null, isLoading: false },
    providers: { data: providers, error: null, isLoading: false },
  };

  return {
    initResponse,
    providers,
    configQueriesState,
    mockCreateReview: vi.fn(),
    mockNavigate: vi.fn(),
    mockUseActiveReviewSession: vi.fn(),
  };
});

// Boundary mock: @tanstack/react-router is the routing boundary; tests provide a stub Router context so route data and navigation can be driven without a full route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({}),
  useLocation: () => ({ pathname: "/" }),
}));

// Boundary mock: api/hooks is the HTTP-data fetch boundary (createApi over fetch); tests provide canned hook return values to drive UI behavior.
vi.mock("@diffgazer/core/api/hooks", () => ({
  configQueries: { all: () => ["config"] },
  useApi: () => ({
    getActiveReviewSession: vi.fn(async () => ({ session: null })),
  }),
  useActiveReviewSession: mockUseActiveReviewSession,
  useActivateProvider: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useCreateReview: () => ({ mutateAsync: mockCreateReview }),
  useDeleteProviderCredentials: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useInit: () => configQueriesState.init,
  useProviderStatus: () => configQueriesState.providers,
  useReview: () => ({ data: undefined, error: null, isLoading: false }),
  useReviews: () => ({ data: { reviews: [] }, error: null, isLoading: false }),
  useSaveConfig: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
}));

import { HomePage } from "./page";

function setActiveSession(unstaged: ActiveSessionState, staged: ActiveSessionState) {
  mockUseActiveReviewSession.mockImplementation((mode?: ReviewMode) => {
    if (mode === "unstaged") return { data: { session: unstaged } };
    if (mode === "staged") return { data: { session: staged } };
    return { data: { session: null } };
  });
}

function renderHomePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <FooterProvider>
            <KeyboardProvider>
              {children}
              <Toaster />
            </KeyboardProvider>
          </FooterProvider>
        </ConfigProvider>
      </QueryClientProvider>
    );
  }

  return render(<HomePage />, { wrapper: Wrapper });
}

describe("HomePage composition", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateReview.mockReset();
    mockCreateReview.mockResolvedValue({ reviewId: "rev-new" });
    mockUseActiveReviewSession.mockReset();
    configQueriesState.init = { data: initResponse, error: null, isLoading: false };
    configQueriesState.providers = { data: providers, error: null, isLoading: false };
    setActiveSession(null, null);
  });

  it("renders the main menu with Resume Last Review disabled when no active session exists", () => {
    renderHomePage();
    const resume = screen.getByRole("menuitem", { name: "Resume Last Review" });

    expect(mockUseActiveReviewSession).toHaveBeenCalledWith("unstaged");
    expect(mockUseActiveReviewSession).toHaveBeenCalledWith("staged");
    expect(resume).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).toBeInTheDocument();
  });

  it("enables Resume Last Review when the active-session hook reports an unstaged session", () => {
    setActiveSession({ reviewId: "rev-unstaged", mode: "unstaged" }, null);
    renderHomePage();
    const resume = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(resume).not.toHaveAttribute("aria-disabled");
  });

  it("keeps trusted home actions when only provider status fails", () => {
    configQueriesState.providers = {
      data: undefined,
      error: new Error("provider status unavailable"),
      isLoading: false,
    };

    renderHomePage();

    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).toBeInTheDocument();
    expect(screen.queryByText("Trust This Repository?")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a configuration error instead of untrusted defaults when init fails", () => {
    configQueriesState.init = {
      data: undefined,
      error: new Error("init unavailable"),
      isLoading: false,
    };

    renderHomePage();

    expect(screen.getByRole("alert")).toHaveTextContent("Configuration unavailable.");
    expect(screen.queryByText("Trust This Repository?")).not.toBeInTheDocument();
  });

  it.each([
    "resolve",
    "reject",
  ])("keeps pending navigation inert and ignores a stale review %s after leaving home", async (outcome) => {
    const review = createDeferred<{ reviewId: string }>();
    mockCreateReview.mockReturnValue(review.promise);
    const user = userEvent.setup();
    const view = renderHomePage();
    const providerSettings = screen.getByRole("button", {
      name: "Configure provider settings",
    });

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Starting review");
    expect(providerSettings.closest("[inert]")).toBeInTheDocument();

    await user.keyboard("h");
    await user.click(providerSettings);
    expect(mockNavigate).not.toHaveBeenCalled();

    view.rerender(<div>External route</div>);

    await act(async () => {
      if (outcome === "resolve") {
        review.resolve({ reviewId: "late-review" });
      } else {
        review.reject(new Error("late failure"));
      }
      await review.promise.catch(() => undefined);
    });

    expect(screen.getByText("External route")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
