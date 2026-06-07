import type { ShutdownResult } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ContextInfo } from "@diffgazer/core/schemas/presentation";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRouterNavigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockRouterNavigate,
}));

import { HomePagePresentation, type HomePagePresentationProps } from "./presentation";

type ActiveSession = { reviewId: string; mode: ReviewMode } | null;
type ActiveSessionResult = { session: ActiveSession };

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

const baseContext: ContextInfo = {
  providerName: "openrouter",
  providerMode: "openrouter/test-model",
  trustedDir: "/repo",
};

function buildProps(overrides: Partial<HomePagePresentationProps> = {}): HomePagePresentationProps {
  return {
    context: baseContext,
    isTrusted: true,
    needsTrust: false,
    projectId: "proj-1",
    repoRoot: "/repo",
    hasResumableSession: false,
    highlighted: null,
    searchError: undefined,
    onHighlightChange: vi.fn(),
    navigate: vi.fn() as unknown as HomePagePresentationProps["navigate"],
    createReview: vi.fn(async () => ({ reviewId: "rev-new" })),
    getActiveReviewSession: vi.fn(async () => ({ session: null })),
    clearScopedRouteState: vi.fn(),
    shutdown: vi.fn(async (): Promise<ShutdownResult> => ({ status: "closed" })),
    ...overrides,
  };
}

function renderPresentation(props: HomePagePresentationProps) {
  return render(<HomePagePresentation {...props} />, { wrapper: Wrapper });
}

describe("HomePagePresentation — Resume Last Review gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterNavigate.mockReset();
  });

  it("disables Resume Last Review when no active session exists for either mode", () => {
    renderPresentation(buildProps({ hasResumableSession: false }));
    const item = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(item).toHaveAttribute("aria-disabled", "true");
  });

  it("does not navigate or start a new review when clicking the disabled Resume Last Review item", async () => {
    const navigate = vi.fn();
    const createReview = vi.fn();
    const getActiveReviewSession = vi.fn();
    const props = buildProps({
      hasResumableSession: false,
      navigate: navigate as unknown as HomePagePresentationProps["navigate"],
      createReview,
      getActiveReviewSession,
    });
    const user = userEvent.setup();
    renderPresentation(props);
    await user.click(screen.getByRole("menuitem", { name: "Resume Last Review" }));
    expect(navigate).not.toHaveBeenCalled();
    expect(createReview).not.toHaveBeenCalled();
    expect(getActiveReviewSession).not.toHaveBeenCalled();
  });

  it("enables and resumes the unstaged session when only unstaged is active", async () => {
    const navigate = vi.fn();
    const createReview = vi.fn();
    const getActiveReviewSession = vi.fn(
      async (mode: ReviewMode): Promise<ActiveSessionResult> => ({
        session: mode === "unstaged" ? { reviewId: "rev-unstaged", mode: "unstaged" } : null,
      }),
    );
    const props = buildProps({
      hasResumableSession: true,
      navigate: navigate as unknown as HomePagePresentationProps["navigate"],
      createReview,
      getActiveReviewSession,
    });
    const user = userEvent.setup();
    renderPresentation(props);
    const item = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(item).not.toHaveAttribute("aria-disabled");
    await user.click(item);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-unstaged" },
        search: { mode: "unstaged", live: true },
      }),
    );
    expect(createReview).not.toHaveBeenCalled();
  });

  it("enables and resumes the staged session when only staged is active", async () => {
    const navigate = vi.fn();
    const createReview = vi.fn();
    const getActiveReviewSession = vi.fn(
      async (mode: ReviewMode): Promise<ActiveSessionResult> => ({
        session: mode === "staged" ? { reviewId: "rev-staged", mode: "staged" } : null,
      }),
    );
    const props = buildProps({
      hasResumableSession: true,
      navigate: navigate as unknown as HomePagePresentationProps["navigate"],
      createReview,
      getActiveReviewSession,
    });
    const user = userEvent.setup();
    renderPresentation(props);
    await user.click(screen.getByRole("menuitem", { name: "Resume Last Review" }));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-staged" },
        search: { mode: "staged", live: true },
      }),
    );
    expect(createReview).not.toHaveBeenCalled();
  });

  it("shows 'No Active Review' toast and does not start a new review when sessions disappear between query and click", async () => {
    const navigate = vi.fn();
    const createReview = vi.fn();
    const getActiveReviewSession = vi.fn(
      async (): Promise<ActiveSessionResult> => ({ session: null }),
    );
    const props = buildProps({
      hasResumableSession: true,
      navigate: navigate as unknown as HomePagePresentationProps["navigate"],
      createReview,
      getActiveReviewSession,
    });
    const user = userEvent.setup();
    renderPresentation(props);
    await user.click(screen.getByRole("menuitem", { name: "Resume Last Review" }));
    expect(await screen.findByText("No Active Review")).toBeInTheDocument();
    expect(screen.getByText("Start a new review from the menu.")).toBeInTheDocument();
    expect(createReview).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("HomePagePresentation — startReview error surfacing", () => {
  function makeApiError(message: string, code: string, status = 500): Error {
    const error = new Error(message) as Error & { status: number; code: string };
    error.status = status;
    error.code = code;
    return error;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterNavigate.mockReset();
  });

  it("surfaces API_KEY_MISSING with an actionable message in the toast", async () => {
    const navigate = vi.fn();
    const createReview = vi.fn(async () => {
      throw makeApiError("API key not found for provider 'zai'", "API_KEY_MISSING");
    });
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        navigate: navigate as unknown as HomePagePresentationProps["navigate"],
        createReview,
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    expect(await screen.findByText("API Key Missing")).toBeInTheDocument();
    expect(
      screen.getByText(/API key not found for provider 'zai'\. Add one in Settings → Providers\./),
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("surfaces UNSUPPORTED_PROVIDER as 'Provider Not Configured'", async () => {
    const createReview = vi.fn(async () => {
      throw makeApiError("AI provider not configured", "UNSUPPORTED_PROVIDER");
    });
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview }));
    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    expect(await screen.findByText("Provider Not Configured")).toBeInTheDocument();
    expect(screen.getByText("Pick an AI provider in Settings → Providers.")).toBeInTheDocument();
  });

  it("falls back to a generic toast for unknown errors", async () => {
    const createReview = vi.fn(async () => {
      throw new Error("boom");
    });
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview }));
    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    expect(await screen.findByText("Failed to Start Review")).toBeInTheDocument();
    expect(screen.getByText("Could not create a review session.")).toBeInTheDocument();
  });
});
