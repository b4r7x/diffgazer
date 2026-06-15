import type { ShutdownResult } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ContextInfo } from "@diffgazer/core/schemas/presentation";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRouterNavigate = vi.hoisted(() => vi.fn());

// Boundary mock: TanStack Router is the external routing library; this presentation test asserts navigation requests.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockRouterNavigate,
}));

import { HomePagePresentation, type HomePagePresentationProps } from "./presentation";

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
    resumableSession: null,
    highlighted: null,
    searchError: undefined,
    onHighlightChange: vi.fn(),
    navigate: vi.fn() as unknown as HomePagePresentationProps["navigate"],
    createReview: vi.fn(async () => ({ reviewId: "rev-new" })),
    clearScopedRouteState: vi.fn(),
    shutdown: vi.fn(async (): Promise<ShutdownResult> => ({ status: "closed" })),
    ...overrides,
  };
}

function renderPresentation(props: HomePagePresentationProps) {
  return render(<HomePagePresentation {...props} />, { wrapper: Wrapper });
}

function StrictWrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <Wrapper>{children}</Wrapper>
    </StrictMode>
  );
}

function renderPresentationStrict(props: HomePagePresentationProps) {
  return render(<HomePagePresentation {...props} />, { wrapper: StrictWrapper });
}

describe("HomePagePresentation — Resume Last Review gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterNavigate.mockReset();
  });

  it("disables Resume Last Review when no resumable session exists", () => {
    renderPresentation(buildProps({ resumableSession: null }));
    const item = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(item).toHaveAttribute("aria-disabled", "true");
  });

  it("does not navigate or start a new review when clicking the disabled Resume Last Review item", async () => {
    const navigate = vi.fn();
    const createReview = vi.fn();
    const props = buildProps({
      resumableSession: null,
      navigate: navigate as unknown as HomePagePresentationProps["navigate"],
      createReview,
    });
    const user = userEvent.setup();
    renderPresentation(props);
    await user.click(screen.getByRole("menuitem", { name: "Resume Last Review" }));
    expect(navigate).not.toHaveBeenCalled();
    expect(createReview).not.toHaveBeenCalled();
  });

  it("enables and resumes the cached unstaged session", async () => {
    const navigate = vi.fn();
    const createReview = vi.fn();
    const props = buildProps({
      resumableSession: { reviewId: "rev-unstaged", mode: "unstaged" },
      navigate: navigate as unknown as HomePagePresentationProps["navigate"],
      createReview,
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

  it("enables and resumes the cached staged session", async () => {
    const navigate = vi.fn();
    const createReview = vi.fn();
    const props = buildProps({
      resumableSession: { reviewId: "rev-staged", mode: "staged" },
      navigate: navigate as unknown as HomePagePresentationProps["navigate"],
      createReview,
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

describe("HomePagePresentation — menu parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterNavigate.mockReset();
  });

  it("renders the Help menu item alongside the rest of the menu", () => {
    renderPresentation(buildProps());
    expect(screen.getByRole("menuitem", { name: "Help" })).toBeInTheDocument();
  });

  it("navigates to history via the home shortcut", async () => {
    const navigate = vi.fn();
    const clearScopedRouteState = vi.fn();
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        navigate: navigate as unknown as HomePagePresentationProps["navigate"],
        clearScopedRouteState,
      }),
    );
    await user.keyboard("h");
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/history" }));
  });

  it("clears each target page's own scoped keys when navigating, never silent no-ops", async () => {
    const navigate = vi.fn();
    const clearScopedRouteState = vi.fn();
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        navigate: navigate as unknown as HomePagePresentationProps["navigate"],
        clearScopedRouteState,
      }),
    );

    // /history stores "run"/"date" — both must be reset so its selection clears (F-159).
    await user.keyboard("h");
    expect(clearScopedRouteState).toHaveBeenCalledWith("/history", "run");
    expect(clearScopedRouteState).toHaveBeenCalledWith("/history", "date");
    expect(clearScopedRouteState).not.toHaveBeenCalledWith("/history", "highlighted");

    clearScopedRouteState.mockClear();

    // /help stores nothing — no clear should fire.
    await user.keyboard("{Shift>}?{/Shift}");
    expect(clearScopedRouteState).not.toHaveBeenCalled();
  });
});

describe("HomePagePresentation — review-start pending state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterNavigate.mockReset();
  });

  it("surfaces a pending status and disables the menu while a review is starting", async () => {
    const resolvers: Array<(value: { reviewId: string }) => void> = [];
    const createReview = vi.fn(
      () =>
        new Promise<{ reviewId: string }>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview }));

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));

    // F-353(a): the in-flight start is now visible and blocks re-activation.
    expect(await screen.findByRole("status")).toHaveTextContent(/starting review/i);
    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    resolvers[0]?.({ reviewId: "rev-new" });
  });
});

describe("HomePagePresentation — invalid review id toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterNavigate.mockReset();
  });

  it("reports an invalid review id exactly once under StrictMode and effect re-runs", async () => {
    const navigate = vi.fn();
    const props = buildProps({
      searchError: "invalid-review-id",
      navigate: navigate as unknown as HomePagePresentationProps["navigate"],
    });
    // StrictMode double-invokes the report effect on mount; the fired-once ref must
    // survive that so the toast + home redirect fire exactly once (F-181).
    const { rerender } = renderPresentationStrict(props);

    expect(await screen.findByText("Invalid Review ID")).toBeInTheDocument();

    // A fresh navigate identity also re-runs the report effect; without the fired-once
    // ref it would re-toast and re-redirect on every re-render (F-181).
    rerender(
      <HomePagePresentation
        {...props}
        navigate={vi.fn() as unknown as HomePagePresentationProps["navigate"]}
      />,
    );
    rerender(
      <HomePagePresentation
        {...props}
        navigate={vi.fn() as unknown as HomePagePresentationProps["navigate"]}
      />,
    );

    expect(screen.getAllByText("Invalid Review ID")).toHaveLength(1);
    expect(navigate.mock.calls.filter(([arg]) => arg?.to === "/" && arg?.replace)).toHaveLength(1);
  });
});
