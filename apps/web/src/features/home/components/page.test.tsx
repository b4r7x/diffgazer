import { FooterProvider } from "@diffgazer/core/footer";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";

type ActiveSessionState = { reviewId: string; mode: ReviewMode } | null;

const { mockNavigate, mockUseActiveReviewSession } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseActiveReviewSession: vi.fn(),
}));

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
  useCreateReview: () => ({ mutateAsync: vi.fn(async () => ({ reviewId: "rev-new" })) }),
  useDeleteProviderCredentials: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useDeleteReview: () => ({ mutateAsync: vi.fn() }),
  useInit: () => ({
    data: {
      config: { provider: "openrouter", model: "openrouter/test-model" },
      providers: [{ provider: "openrouter", hasApiKey: true, isActive: true }],
      project: {
        projectId: "proj-1",
        path: "/repo",
        trust: { repoRoot: "/repo", capabilities: { readFiles: true } },
      },
      setup: { isConfigured: true, isReady: true, missing: [] },
    },
    error: null,
    isLoading: false,
  }),
  useProviderStatus: () => ({
    data: [{ provider: "openrouter", hasApiKey: true, isActive: true }],
    error: null,
    isLoading: false,
  }),
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
    mockUseActiveReviewSession.mockReset();
    setActiveSession(null, null);
  });

  it("renders the main menu with Resume Last Review disabled when no active session exists", () => {
    renderHomePage();
    const resume = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(resume).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).toBeInTheDocument();
  });

  it("enables Resume Last Review when the active-session hook reports an unstaged session", () => {
    setActiveSession({ reviewId: "rev-unstaged", mode: "unstaged" }, null);
    renderHomePage();
    const resume = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(resume).not.toHaveAttribute("aria-disabled");
  });
});
