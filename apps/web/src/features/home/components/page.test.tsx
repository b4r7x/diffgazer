import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { FooterProvider } from "@diffgazer/core/footer";
import { Toaster } from "@diffgazer/ui/components/toast";
import type { ReactNode } from "react";

interface ActiveSessionPayload {
  session: { reviewId: string; mode: "unstaged" | "staged" } | null;
}

const {
  mockNavigate,
  mockGetActiveReviewSession,
  mockCreateReview,
  mockUseActiveReviewSession,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetActiveReviewSession: vi.fn(),
  mockCreateReview: vi.fn(),
  mockUseActiveReviewSession: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({}),
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("@/hooks/use-scoped-route-state", () => ({
  useScopedRouteState: (_key: string, defaultValue: unknown) => [defaultValue, vi.fn()],
  clearScopedRouteState: vi.fn(),
}));

vi.mock("@/app/providers/config-provider", () => ({
  useConfigData: () => ({
    provider: "openrouter",
    model: "openrouter/test-model",
    trust: { repoRoot: "/repo", capabilities: { readFiles: true } },
    repoRoot: "/repo",
    projectId: "proj-1",
  }),
}));

vi.mock("@/features/history/hooks/use-review-history", () => ({
  useReviewHistory: () => ({ reviews: [] }),
}));

vi.mock("@/features/home/utils/shutdown", () => ({
  shutdown: vi.fn(async () => ({ status: "closed" as const })),
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useApi: () => ({
    getActiveReviewSession: mockGetActiveReviewSession,
  }),
  useCreateReview: () => ({
    mutateAsync: mockCreateReview,
  }),
  useActiveReviewSession: mockUseActiveReviewSession,
}));

import { HomePage } from "./page";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <FooterProvider>
      <KeyboardProvider>
        {children}
        <Toaster />
      </KeyboardProvider>
    </FooterProvider>
  );
}

function renderPage() {
  return render(<HomePage />, { wrapper: Wrapper });
}

function setActiveSessions(options: {
  unstaged: ActiveSessionPayload["session"];
  staged: ActiveSessionPayload["session"];
}) {
  mockUseActiveReviewSession.mockImplementation((mode?: "unstaged" | "staged") => {
    if (mode === "unstaged") return { data: { session: options.unstaged } };
    if (mode === "staged") return { data: { session: options.staged } };
    return { data: { session: null } };
  });
}

describe("HomePage — Resume Last Review gating", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetActiveReviewSession.mockReset();
    mockCreateReview.mockReset();
    mockUseActiveReviewSession.mockReset();
    mockUseActiveReviewSession.mockReturnValue({ data: { session: null } });
  });

  it("disables Resume Last Review when no active session exists for either mode", () => {
    setActiveSessions({ unstaged: null, staged: null });
    renderPage();
    const item = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(item).toHaveAttribute("aria-disabled", "true");
  });

  it("does not navigate or start a new review when clicking the disabled Resume Last Review item", async () => {
    setActiveSessions({ unstaged: null, staged: null });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("menuitem", { name: "Resume Last Review" }));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockCreateReview).not.toHaveBeenCalled();
    expect(mockGetActiveReviewSession).not.toHaveBeenCalled();
  });

  it("enables and resumes the unstaged session when only unstaged is active", async () => {
    setActiveSessions({
      unstaged: { reviewId: "rev-unstaged", mode: "unstaged" },
      staged: null,
    });
    mockGetActiveReviewSession.mockImplementation(async (mode?: "unstaged" | "staged") => ({
      session: mode === "unstaged" ? { reviewId: "rev-unstaged", mode: "unstaged" } : null,
    }));
    const user = userEvent.setup();
    renderPage();
    const item = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(item).not.toHaveAttribute("aria-disabled");
    await user.click(item);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-unstaged" },
        search: { mode: "unstaged", live: true },
      }),
    );
    expect(mockCreateReview).not.toHaveBeenCalled();
  });

  it("enables and resumes the staged session when only staged is active", async () => {
    setActiveSessions({
      unstaged: null,
      staged: { reviewId: "rev-staged", mode: "staged" },
    });
    mockGetActiveReviewSession.mockImplementation(async (mode?: "unstaged" | "staged") => ({
      session: mode === "staged" ? { reviewId: "rev-staged", mode: "staged" } : null,
    }));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("menuitem", { name: "Resume Last Review" }));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-staged" },
        search: { mode: "staged", live: true },
      }),
    );
    expect(mockCreateReview).not.toHaveBeenCalled();
  });

  it("shows 'No Active Review' toast and does not start a new review when sessions disappear between query and click", async () => {
    setActiveSessions({
      unstaged: { reviewId: "rev-unstaged", mode: "unstaged" },
      staged: null,
    });
    mockGetActiveReviewSession.mockResolvedValue({ session: null });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("menuitem", { name: "Resume Last Review" }));
    expect(await screen.findByText("No Active Review")).toBeInTheDocument();
    expect(screen.getByText("Start a new review from the menu.")).toBeInTheDocument();
    expect(mockCreateReview).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("HomePage — startReview error surfacing", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetActiveReviewSession.mockReset();
    mockCreateReview.mockReset();
    mockUseActiveReviewSession.mockReset();
    mockUseActiveReviewSession.mockReturnValue({ data: { session: null } });
  });

  function makeApiError(message: string, code: string, status = 500): Error {
    const error = new Error(message) as Error & { status: number; code: string };
    error.status = status;
    error.code = code;
    return error;
  }

  it("surfaces API_KEY_MISSING with an actionable message in the toast", async () => {
    mockCreateReview.mockRejectedValue(
      makeApiError("API key not found for provider 'zai'", "API_KEY_MISSING"),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    expect(await screen.findByText("API Key Missing")).toBeInTheDocument();
    expect(
      screen.getByText(/API key not found for provider 'zai'\. Add one in Settings → Providers\./),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("surfaces UNSUPPORTED_PROVIDER as 'Provider Not Configured'", async () => {
    mockCreateReview.mockRejectedValue(
      makeApiError("AI provider not configured", "UNSUPPORTED_PROVIDER"),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    expect(await screen.findByText("Provider Not Configured")).toBeInTheDocument();
    expect(
      screen.getByText("Pick an AI provider in Settings → Providers."),
    ).toBeInTheDocument();
  });

  it("falls back to a generic toast for unknown errors", async () => {
    mockCreateReview.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    expect(await screen.findByText("Failed to Start Review")).toBeInTheDocument();
    expect(
      screen.getByText("Could not create a review session."),
    ).toBeInTheDocument();
  });
});
