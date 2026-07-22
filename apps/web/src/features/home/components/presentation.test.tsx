import type { ShutdownResult } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ContextInfo } from "@diffgazer/core/schemas/presentation";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRouterNavigate = vi.hoisted(() => vi.fn());

// Boundary mock: TanStack Router is the external routing library; this presentation test asserts navigation requests.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockRouterNavigate,
}));

import { HomePagePresentation, type HomePagePresentationProps } from "./presentation";

type Navigate = HomePagePresentationProps["navigate"];

function createNavigateMock() {
  const mock = vi.fn<(options: object) => Promise<void>>(() => Promise.resolve());
  const navigate: Navigate = (options) => mock(options);

  return { navigate, mock };
}

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
  providerModel: "openrouter/test-model",
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
    navigate: createNavigateMock().navigate,
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

  it("renders trusted, provider, and last-run context when data is present", () => {
    renderPresentation(
      buildProps({
        context: {
          ...baseContext,
          lastRunId: "12345678-1234-4123-8123-123456789abc",
          lastRunIssueCount: 2,
        },
      }),
    );

    expect(screen.getByText("Trusted")).toBeInTheDocument();
    expect(screen.getByText("/repo")).toBeInTheDocument();
    expect(screen.getByText("Provider")).toBeInTheDocument();
    expect(screen.getByText("openrouter (openrouter/test-model)")).toBeInTheDocument();
    expect(screen.getByText("Last Run")).toBeInTheDocument();
    expect(screen.getByText("#12345678")).toBeInTheDocument();
    expect(screen.getByText("(2 issues)")).toBeInTheDocument();
    expect(screen.queryByText(/12345678-1234/)).not.toBeInTheDocument();
  });

  it("renders every context row with explicit values when data is absent", () => {
    renderPresentation(buildProps({ context: {}, isTrusted: false, repoRoot: null }));

    expect(screen.getByText("Not trusted")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Provider")).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.getByText("Last Run")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("disables Resume Last Review when no resumable session exists", () => {
    renderPresentation(buildProps({ resumableSession: null }));
    const item = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(item).toHaveAttribute("aria-disabled", "true");
  });

  it("enables and resumes the cached unstaged session", async () => {
    const navigateMock = createNavigateMock();
    const createReview = vi.fn();
    const props = buildProps({
      resumableSession: { reviewId: "rev-unstaged", mode: "unstaged" },
      navigate: navigateMock.navigate,
      createReview,
    });
    const user = userEvent.setup();
    renderPresentation(props);
    const item = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(item).not.toHaveAttribute("aria-disabled");
    await user.click(item);
    expect(navigateMock.mock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-unstaged" },
        search: { mode: "unstaged", live: true },
      }),
    );
    expect(createReview).not.toHaveBeenCalled();
  });

  it("enables and resumes the cached staged session", async () => {
    const navigateMock = createNavigateMock();
    const createReview = vi.fn();
    const props = buildProps({
      resumableSession: { reviewId: "rev-staged", mode: "staged" },
      navigate: navigateMock.navigate,
      createReview,
    });
    const user = userEvent.setup();
    renderPresentation(props);
    await user.click(screen.getByRole("menuitem", { name: "Resume Last Review" }));
    expect(navigateMock.mock).toHaveBeenCalledWith(
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
    const navigateMock = createNavigateMock();
    const createReview = vi.fn(async () => {
      throw makeApiError("API key not found for provider 'zai'", "API_KEY_MISSING");
    });
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        navigate: navigateMock.navigate,
        createReview,
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    expect(await screen.findByText("API Key Missing")).toBeInTheDocument();
    expect(
      screen.getByText(/API key not found for provider 'zai'\. Add one in Settings → Providers\./),
    ).toBeInTheDocument();
    expect(navigateMock.mock).not.toHaveBeenCalled();
  });
});

describe("HomePagePresentation — menu parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterNavigate.mockReset();
  });

  it("navigates to history via the home menu", async () => {
    const navigateMock = createNavigateMock();
    const clearScopedRouteState = vi.fn();
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        navigate: navigateMock.navigate,
        clearScopedRouteState,
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "History" }));
    expect(navigateMock.mock).toHaveBeenCalledWith(expect.objectContaining({ to: "/history" }));
  });

  it("clears each target page's own scoped keys when navigating, never silent no-ops", async () => {
    const navigateMock = createNavigateMock();
    const clearScopedRouteState = vi.fn();
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        navigate: navigateMock.navigate,
        clearScopedRouteState,
      }),
    );

    // /history stores "run"/"date" — both must be reset so its selection clears.
    await user.click(screen.getByRole("menuitem", { name: "History" }));
    expect(clearScopedRouteState).toHaveBeenCalledWith("/history", "run");
    expect(clearScopedRouteState).toHaveBeenCalledWith("/history", "date");
    expect(clearScopedRouteState).not.toHaveBeenCalledWith("/history", "highlighted");

    clearScopedRouteState.mockClear();

    await user.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(clearScopedRouteState).toHaveBeenCalledWith("/settings", "highlighted");
    expect(clearScopedRouteState).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: "/settings" }),
    );

    clearScopedRouteState.mockClear();

    // /help stores nothing — no clear should fire.
    await user.click(screen.getByRole("menuitem", { name: "Help" }));
    expect(clearScopedRouteState).not.toHaveBeenCalled();
  });
});

describe("HomePagePresentation — review-start pending state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterNavigate.mockReset();
  });

  it("surfaces a pending status, then resolves to a single navigation and clears the status", async () => {
    let resolveReview: ((value: { reviewId: string }) => void) | undefined;
    const reviewPromise = new Promise<{ reviewId: string }>((resolve) => {
      resolveReview = resolve;
    });
    const createReview = vi.fn(() => reviewPromise);
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview, navigate: navigateMock.navigate }));

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));

    // F-353(a): the in-flight start is now visible and blocks re-activation.
    expect(await screen.findByRole("status")).toHaveTextContent(/starting review/i);
    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await act(async () => {
      resolveReview?.({ reviewId: "rev-new" });
      await reviewPromise;
    });

    expect(navigateMock.mock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-new" },
        search: { mode: "unstaged", live: true },
      }),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("HomePagePresentation — invalid review id toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterNavigate.mockReset();
  });

  it("reports an invalid review id exactly once under StrictMode and effect re-runs", async () => {
    const navigateMock = createNavigateMock();
    const props = buildProps({
      searchError: "invalid-review-id",
      navigate: navigateMock.navigate,
    });
    // StrictMode double-invokes the report effect on mount; the fired-once ref must
    // survive that so the toast + home redirect fire exactly once.
    const { rerender } = renderPresentationStrict(props);

    expect(await screen.findByText("Invalid Review ID")).toBeInTheDocument();

    // A fresh navigate identity also re-runs the report effect; without the fired-once
    // ref it would re-toast and re-redirect on every re-render.
    rerender(<HomePagePresentation {...props} navigate={createNavigateMock().navigate} />);
    rerender(<HomePagePresentation {...props} navigate={createNavigateMock().navigate} />);

    expect(screen.getAllByText("Invalid Review ID")).toHaveLength(1);
    expect(navigateMock.mock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock).toHaveBeenCalledWith(
      expect.objectContaining({ replace: true, to: "/" }),
    );
  });
});

describe("HomePagePresentation — quit result surfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterNavigate.mockReset();
  });

  // Runs first: the other rows leave persistent error/warning toasts in the
  // shared toast store, which would otherwise make this absence check flaky.
  it("shows neither notice when shutdown closes cleanly", async () => {
    const shutdown = vi.fn(async (): Promise<ShutdownResult> => ({ status: "closed" }));
    const user = userEvent.setup();
    renderPresentation(buildProps({ shutdown }));

    await user.click(screen.getByRole("menuitem", { name: "Quit" }));
    await waitFor(() => expect(shutdown).toHaveBeenCalledOnce());

    expect(screen.queryByText("Close Tab Manually")).not.toBeInTheDocument();
    expect(screen.queryByText("Quit Failed")).not.toBeInTheDocument();
  });

  it.each([
    { status: "unsupported", message: "Close this tab manually.", title: "Close Tab Manually" },
    { status: "error", message: "The shutdown request failed.", title: "Quit Failed" },
  ] as const)("shows $title when shutdown reports $status", async ({ status, message, title }) => {
    const shutdown = vi.fn(async (): Promise<ShutdownResult> => ({ status, message }));
    const user = userEvent.setup();
    renderPresentation(buildProps({ shutdown }));

    await user.click(screen.getByRole("menuitem", { name: "Quit" }));

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
