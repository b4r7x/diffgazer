import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { InitResponse, ProviderStatus } from "@diffgazer/core/schemas/config";
import type { ActiveReviewSession, CreateReviewResponse } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import {
  makeActiveReviewSession,
  makeCreateReviewResponse,
} from "@diffgazer/core/testing/factories";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

type ActiveSessionState = ActiveReviewSession | null;

const mockNavigate = vi.fn();

// Boundary mock: @tanstack/react-router is the routing boundary; tests provide a stub Router context so route data and navigation can be driven without a full route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({}),
  useLocation: () => ({ pathname: "/" }),
}));

import { HomePage } from "./page";

function makeInitResponse(): InitResponse {
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
  };
}

const providers = [
  { provider: "openrouter", hasApiKey: true, isActive: true },
] satisfies ProviderStatus[];

let mockLoadInit: Mock<BoundApi["loadInit"]>;
let mockGetProviderStatus: Mock<BoundApi["getProviderStatus"]>;
let mockGetReviews: Mock<BoundApi["getReviews"]>;
let mockGetActiveReviewSession: Mock<BoundApi["getActiveReviewSession"]>;
let mockCreateReview: Mock<BoundApi["createReview"]>;

let unstagedActiveSession: ActiveSessionState = null;
let stagedActiveSession: ActiveSessionState = null;

function setActiveSessions(unstaged: ActiveSessionState, staged: ActiveSessionState) {
  unstagedActiveSession = unstaged;
  stagedActiveSession = staged;
}

function createTestApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    loadInit: mockLoadInit,
    getProviderStatus: mockGetProviderStatus,
    getReviews: mockGetReviews,
    getActiveReviewSession: mockGetActiveReviewSession,
    createReview: mockCreateReview,
  } satisfies BoundApi;
}

function renderHomePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const api = createTestApi();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <FooterProvider>
              <KeyboardProvider>
                {children}
                <Toaster />
              </KeyboardProvider>
            </FooterProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  }

  return render(<HomePage />, { wrapper: Wrapper });
}

describe("HomePage composition", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    setActiveSessions(null, null);

    mockLoadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse());
    mockGetProviderStatus = vi.fn<BoundApi["getProviderStatus"]>().mockResolvedValue(providers);
    mockGetReviews = vi.fn<BoundApi["getReviews"]>().mockResolvedValue({ reviews: [] });
    mockGetActiveReviewSession = vi
      .fn<BoundApi["getActiveReviewSession"]>()
      .mockImplementation(async (mode) => {
        if (mode === "unstaged") return { session: unstagedActiveSession };
        if (mode === "staged") return { session: stagedActiveSession };
        return { session: null };
      });
    mockCreateReview = vi
      .fn<BoundApi["createReview"]>()
      .mockResolvedValue(makeCreateReviewResponse());
  });

  it("renders the main menu with Resume Last Review disabled when no active session exists", async () => {
    renderHomePage();
    const resume = await screen.findByRole("menuitem", { name: "Resume Last Review" });

    expect(resume).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).toBeInTheDocument();
  });

  it.each([
    {
      label: "unstaged",
      unstaged: makeActiveReviewSession({ mode: "unstaged" }),
      staged: null,
    },
    {
      label: "staged",
      unstaged: null,
      staged: makeActiveReviewSession({ mode: "staged" }),
    },
  ])("enables Resume Last Review when an active $label session exists", async ({
    unstaged,
    staged,
  }) => {
    setActiveSessions(unstaged, staged);
    renderHomePage();
    const resume = await screen.findByRole("menuitem", { name: "Resume Last Review" });
    expect(resume).not.toHaveAttribute("aria-disabled");
  });

  it("keeps trusted home actions when only provider status fails", async () => {
    mockGetProviderStatus.mockRejectedValue(new Error("provider status unavailable"));

    renderHomePage();

    expect(await screen.findByRole("menuitem", { name: "Review Unstaged" })).toBeInTheDocument();
    expect(screen.queryByText("Trust This Repository?")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a configuration error instead of untrusted defaults when init fails", async () => {
    mockLoadInit.mockRejectedValue(new Error("init unavailable"));

    renderHomePage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Configuration unavailable.");
    expect(screen.queryByText("Trust This Repository?")).not.toBeInTheDocument();
  });

  it.each([
    "resolve",
    "reject",
  ])("keeps pending navigation inert and ignores a stale review %s after leaving home", async (outcome) => {
    const review = createDeferred<CreateReviewResponse>();
    mockCreateReview.mockReturnValue(review.promise);
    const user = userEvent.setup();
    const view = renderHomePage();
    const providerSettings = await screen.findByRole("button", {
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
        review.resolve(makeCreateReviewResponse());
      } else {
        review.reject(new Error("late failure"));
      }
      await review.promise.catch(() => undefined);
    });

    expect(screen.getByText("External route")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  }, 20_000);
});
