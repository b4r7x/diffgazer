import { createApi } from "@diffgazer/core/api";
import { ApiProvider, useProviderConsentGate } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { HomeContextInfo } from "@diffgazer/core/schemas/presentation";
import { KeyboardProvider, useKey } from "@diffgazer/keys";
import { Toaster, toast } from "@diffgazer/ui/components/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderConsentDialog } from "@/components/shared/provider-consent-dialog";
import type { ShutdownResult } from "@/lib/shutdown";

import { FooterView } from "@/testing/footer-view";
import { expectSingleReticle } from "@/testing/reticle";
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

const baseContext: HomeContextInfo = {
  providerName: "openrouter",
  providerModel: "openrouter/test-model",
  trustedDir: "/repo",
};

function buildProps(overrides: Partial<HomePagePresentationProps> = {}): HomePagePresentationProps {
  return {
    context: baseContext,
    isTrusted: true,
    needsTrust: false,
    repoRoot: "/repo",
    resumableSession: null,
    highlighted: null,
    searchError: undefined,
    onHighlightChange: vi.fn(),
    navigate: createNavigateMock().navigate,
    createReview: vi.fn(async () => ({ reviewId: "rev-new" })),
    refetchActiveSession: vi.fn(async () => ({ status: "read" as const, session: null })),
    requireProviderConsent: (action) => action(),
    clearScopedRouteState: vi.fn(),
    shutdown: vi.fn(async (): Promise<ShutdownResult> => ({ status: "closed" })),
    ...overrides,
  };
}

function renderPresentation(props: HomePagePresentationProps) {
  return render(<HomePagePresentation {...props} />, { wrapper: Wrapper });
}

/** Stands in for the next handler home's declined keys have to reach. */
function TrustKeyProbe({ onPress }: { onPress: () => void }) {
  useKey("t", onPress, { scope: "home" });
  return null;
}

function renderPresentationWithApi(props: HomePagePresentationProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    saveTrust: vi.fn(async () => ({
      trust: {
        projectId: "proj-1",
        repoRoot: "/some/repo",
        capabilities: { readFiles: true, runCommands: false },
        trustMode: "persistent" as const,
        trustedAt: "2026-01-01T00:00:00.000Z",
      },
    })),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <HomePagePresentation {...props} />
        <FooterView />
      </ApiProvider>
    </QueryClientProvider>,
    { wrapper: Wrapper },
  );
}

// The real gate and notice, wired the way the app shell wires them, so the
// consent-gated start path runs end to end: r opens the notice, Accept saves
// the consent and continues the held start.
function ConsentGatedHome(props: HomePagePresentationProps) {
  const gate = useProviderConsentGate(null);
  return (
    <>
      <HomePagePresentation {...props} requireProviderConsent={gate.require} />
      <ProviderConsentDialog
        open={gate.isOpen}
        onOpenChange={(open) => {
          if (!open) gate.decline();
        }}
        consent={gate.readBack}
        continues={gate.continues}
        isAccepting={gate.isAccepting}
        error={gate.error}
        onAccept={gate.accept}
      />
    </>
  );
}

function renderConsentGatedHome(props: HomePagePresentationProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    saveSettings: vi.fn(async () => {}),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <ConsentGatedHome {...props} />
      </ApiProvider>
    </QueryClientProvider>,
    { wrapper: Wrapper },
  );
}

// Toasts live in a module-scoped store that outlives `cleanup()`, so the
// persistent error/warning toasts one row raises would otherwise leak into the
// next row's absence checks. Draining goes through the public dismiss API and
// waits for the Toaster to unmount them; the toast root is queried by its DOM
// contract because a dismissed toast has no accessible name left to match.
async function drainToasts() {
  const { unmount } = render(<Toaster />);
  act(() => {
    toast.dismiss();
  });
  await waitFor(() => expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(0));
  unmount();
}

beforeEach(async () => {
  await drainToasts();
});

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

describe("HomePagePresentation — first-run trust prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the trust panel instead of the menu when trust is needed before a project id exists", async () => {
    renderPresentationWithApi(
      buildProps({
        isTrusted: false,
        needsTrust: true,
        repoRoot: "/some/repo",
      }),
    );

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /main menu/i })).not.toBeInTheDocument();
  });

  it("keeps the app-wide jump keys in the footer while the menu rows are hidden", async () => {
    renderPresentationWithApi(
      buildProps({
        isTrusted: false,
        needsTrust: true,
        repoRoot: "/some/repo",
      }),
    );

    expect(await screen.findByText("Navigate Permissions")).toBeInTheDocument();
    expect(screen.getByText("Toggle")).toBeInTheDocument();
    expect(screen.getByText("Quit")).toBeInTheDocument();
    // "?" is the live help binding; "h" opens history and is not a trust-panel key.
    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("h")).not.toBeInTheDocument();
  });
});

describe("HomePagePresentation — Resume Last Review gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("brackets only the menu, the pane the keys drive", async () => {
    const { container } = renderPresentation(buildProps());

    // The menu autofocuses a frame after mount, so its brackets arrive with real
    // focus instead of being claimed at mount.
    const menu = screen.getByRole("region", { name: /main menu/i });
    await waitFor(() => expect(menu).toHaveAttribute("data-state", "focused"));
    expectSingleReticle(container);
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
    expect(screen.getByText("2 issues")).toBeInTheDocument();
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

  it("keeps Resume Last Review reachable and says why when the session cannot be read", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        resumableSession: null,
        isResumeUnavailable: true,
        navigate: navigateMock.navigate,
      }),
    );

    const item = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(item).not.toHaveAttribute("aria-disabled");

    await user.click(item);

    // The user is told the state is unknown instead of being told there is
    // nothing to resume, which would invite a second review over a live one.
    expect(await screen.findByText("Active Review Unavailable")).toBeInTheDocument();
    expect(navigateMock.mock).not.toHaveBeenCalled();
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

describe("HomePagePresentation — composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders no wordmark of its own — the shell header owns the hero", () => {
    renderPresentation(buildProps());

    expect(screen.queryByRole("img", { name: "diffgazer" })).not.toBeInTheDocument();
    expect(screen.queryByText("─ ✦ ─ ✧ ─")).not.toBeInTheDocument();
  });

  it("lets each pane keep its own height instead of stretching both to one line", () => {
    renderPresentation(buildProps());

    const menu = screen.getByRole("region", { name: /main menu/i });
    const context = screen.getByRole("region", { name: /context/i });
    const paneRow = menu.parentElement;

    expect(paneRow).not.toBeNull();
    expect(context.parentElement).toBe(paneRow);
    // jsdom computes no layout, so the guard pins the corrective class the fix
    // depends on: `align-items` defaults to stretch, so the desktop dead band
    // returns the moment `lg:items-start` leaves the shared row — no
    // `items-stretch` class is ever written. Word-bounded so a longer utility
    // that merely contains this name cannot satisfy it.
    expect(paneRow?.className).toMatch(/\blg:items-start\b/);
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

  it("keeps the admission fast-fail on screen with a jump to the providers page", async () => {
    const navigateMock = createNavigateMock();
    const remediation =
      "This model could not produce Diffgazer's structured review output. Select a different model or update the configuration.";
    const createReview = vi.fn(async () => {
      throw makeApiError(remediation, "SETUP_REQUIRED", 403);
    });
    const user = userEvent.setup();
    renderPresentation(buildProps({ navigate: navigateMock.navigate, createReview }));

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));

    expect(await screen.findByText("Configuration Needs Attention")).toBeInTheDocument();
    expect(screen.getByText(remediation)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Providers" }));
    expect(navigateMock.mock).toHaveBeenCalledWith({ to: "/settings/providers" });
  });

  it("opens the running review when the refused start matches the live session's mode", async () => {
    const navigateMock = createNavigateMock();
    const createReview = vi.fn(async () => {
      throw makeApiError("A review is already running", "REVIEW_IN_PROGRESS", 409);
    });
    const refetchActiveSession = vi.fn(async () => ({
      status: "read" as const,
      session: { reviewId: "rev-live", mode: "unstaged" as const },
    }));
    const user = userEvent.setup();
    renderPresentation(
      buildProps({ navigate: navigateMock.navigate, createReview, refetchActiveSession }),
    );

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));

    await waitFor(() =>
      expect(navigateMock.mock).toHaveBeenCalledWith({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-live" },
        search: { mode: "unstaged", live: true },
      }),
    );
    expect(refetchActiveSession).toHaveBeenCalled();
    // What happened is reported, not raised: the attach toast is informational,
    // so it never takes the assertive role="alert" path a failure would.
    const notice = await screen.findByText("Opened the Running Review");
    expect(notice.closest('[role="alert"]')).toBeNull();
    expect(screen.queryByText("Review Already Running")).not.toBeInTheDocument();
  });

  it("offers the running review instead of opening it when it belongs to the other mode", async () => {
    const navigateMock = createNavigateMock();
    const createReview = vi.fn(async () => {
      throw makeApiError("A review is already running", "REVIEW_IN_PROGRESS", 409);
    });
    const refetchActiveSession = vi.fn(async () => ({
      status: "read" as const,
      session: { reviewId: "rev-staged", mode: "staged" as const },
    }));
    const user = userEvent.setup();
    renderPresentation(
      buildProps({ navigate: navigateMock.navigate, createReview, refetchActiveSession }),
    );

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));

    expect(await screen.findByText("Review Already Running")).toBeInTheDocument();
    // The refusal names both modes, so the user knows the running review is not
    // the one they asked for before deciding to open it.
    expect(
      screen.getByText(
        "The running review covers staged changes. Open it, or cancel it before starting one for unstaged changes.",
      ),
    ).toBeInTheDocument();
    expect(navigateMock.mock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Open Running Review" }));

    expect(navigateMock.mock).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "rev-staged" },
      search: { mode: "staged", live: true },
    });
  });

  it("falls back to the session read at mount when the refused start cannot re-read one", async () => {
    const navigateMock = createNavigateMock();
    const createReview = vi.fn(async () => {
      throw makeApiError("A review is already running", "REVIEW_IN_PROGRESS", 409);
    });
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        navigate: navigateMock.navigate,
        createReview,
        refetchActiveSession: vi.fn(async () => ({ status: "unreadable" as const })),
        resumableSession: { reviewId: "rev-cached", mode: "unstaged" },
      }),
    );

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));

    await waitFor(() =>
      expect(navigateMock.mock).toHaveBeenCalledWith({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-cached" },
        search: { mode: "unstaged", live: true },
      }),
    );
    expect(await screen.findByText("Opened the Running Review")).toBeInTheDocument();
  });

  it("ignores the session read at mount when the re-read authoritatively finds none", async () => {
    const navigateMock = createNavigateMock();
    const createReview = vi.fn(async () => {
      throw makeApiError("A review is already running", "REVIEW_IN_PROGRESS", 409);
    });
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        navigate: navigateMock.navigate,
        createReview,
        refetchActiveSession: vi.fn(async () => ({ status: "read" as const, session: null })),
        resumableSession: { reviewId: "rev-finished", mode: "unstaged" },
      }),
    );

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));

    expect(await screen.findByText("Review Already Running")).toBeInTheDocument();
    expect(navigateMock.mock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Open Running Review" })).not.toBeInTheDocument();
  });

  it("keeps the plain refusal on screen when no running review can be read", async () => {
    const navigateMock = createNavigateMock();
    const createReview = vi.fn(async () => {
      throw makeApiError("A review is already running", "REVIEW_IN_PROGRESS", 409);
    });
    const refetchActiveSession = vi.fn(async () => {
      throw new Error("active session unavailable");
    });
    const user = userEvent.setup();
    renderPresentation(
      buildProps({ navigate: navigateMock.navigate, createReview, refetchActiveSession }),
    );

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));

    expect(await screen.findByText("Review Already Running")).toBeInTheDocument();
    expect(
      screen.getByText(/A review is already running for this configuration\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Running Review" })).not.toBeInTheDocument();
    expect(navigateMock.mock).not.toHaveBeenCalled();
  });

  it("clears the starting state when the start fails, handing the menu back", async () => {
    let rejectReview: ((error: Error) => void) | undefined;
    const reviewPromise = new Promise<{ reviewId: string }>((_resolve, reject) => {
      rejectReview = reject;
    });
    const createReview = vi.fn(() => reviewPromise);
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview }));

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    const liveRegion = await screen.findByRole("status");
    expect(liveRegion).toHaveTextContent(/starting review/i);

    // The lazy-validation start aborts cheaply on an unprovable configuration,
    // so the rejection lands while the row still carries the run state.
    await act(async () => {
      rejectReview?.(makeApiError("Structured output is not supported", "CONFORMANCE_FAILED", 422));
      await reviewPromise.catch(() => undefined);
    });

    expect(await screen.findByText("Failed to Start Review")).toBeInTheDocument();
    // Without the resolve arm the failed start leaves the whole menu
    // aria-disabled under a spinner that never stops — the original complaint,
    // one abort later — so every row must be activatable again.
    const startedRow = screen.getByRole("menuitem", { name: "Review Unstaged" });
    expect(startedRow).not.toHaveAttribute("aria-disabled");
    expect(startedRow).not.toHaveAttribute("aria-busy");
    expect(startedRow).not.toHaveTextContent(/starting/i);
    expect(screen.getByRole("menuitem", { name: "Review Staged" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent("");
  });

  it("does not open a review that arrives after the user left home", async () => {
    let resolveReview: ((result: { reviewId: string }) => void) | undefined;
    const createReview = vi.fn(
      () =>
        new Promise<{ reviewId: string }>((resolve) => {
          resolveReview = resolve;
        }),
    );
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    const { unmount } = renderPresentation(
      buildProps({ createReview, navigate: navigateMock.navigate }),
    );

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    await waitFor(() => expect(createReview).toHaveBeenCalledTimes(1));

    // App-wide keys can leave home mid-start; the late review must not pull the
    // user back off whatever screen they moved to.
    unmount();
    await act(async () => {
      resolveReview?.({ reviewId: "rev-new" });
    });

    expect(navigateMock.mock).not.toHaveBeenCalled();
  });

  it("hands the start to the provider consent gate and creates nothing until it runs it", async () => {
    const createReview = vi.fn(async () => ({ reviewId: "rev-new" }));
    const held: Array<() => void> = [];
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        createReview,
        navigate: navigateMock.navigate,
        requireProviderConsent: (action) => held.push(action),
      }),
    );

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    expect(held).toHaveLength(1);
    expect(createReview).not.toHaveBeenCalled();
    // The row is not pending while the notice is up: nothing has started yet.
    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).toBeEnabled();

    await act(async () => {
      held[0]?.();
    });
    await waitFor(() => expect(createReview).toHaveBeenCalledWith({ mode: "unstaged" }));
    expect(navigateMock.mock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/review/{-$reviewId}", params: { reviewId: "rev-new" } }),
    );
  });

  it("starts a second review after a failed one, so the guard does not latch", async () => {
    const createReview = vi
      .fn<() => Promise<{ reviewId: string }>>()
      .mockRejectedValueOnce(makeApiError("Model not selected", "MODEL_ERROR", 400))
      .mockResolvedValueOnce({ reviewId: "rev-new" });
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview, navigate: navigateMock.navigate }));

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));
    expect(await screen.findByText("Model Not Selected")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Review Unstaged" }));

    await waitFor(() => expect(createReview).toHaveBeenCalledTimes(2));
    expect(navigateMock.mock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-new" },
      }),
    );
  });
});

describe("HomePagePresentation — menu parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    // The in-flight start is visible and a second press is refused.
    const liveRegion = await screen.findByRole("status");
    expect(liveRegion).toHaveTextContent(/starting review/i);
    const startedRow = screen.getByRole("menuitem", { name: "Review Unstaged" });
    // Working, not blocked: the row stays available, and pressing it again is
    // refused by the start handler rather than by an unavailable control.
    expect(startedRow).toHaveAttribute("aria-busy", "true");
    expect(startedRow).not.toHaveAttribute("aria-disabled");
    await user.click(startedRow);
    expect(createReview).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menuitem", { name: "Review Staged" })).not.toHaveAttribute(
      "aria-busy",
    );
    // The row that was pressed is the one carrying the run state.
    expect(startedRow).toHaveTextContent(/starting/i);
    expect(screen.getByRole("menuitem", { name: "Review Staged" })).not.toHaveTextContent(
      /starting/i,
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
    // The region stays mounted so a later start is announced; only its text goes.
    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent("");
  });

  it("hands focus from the sidebar to the menu when the start makes the sidebar inert", async () => {
    const createReview = vi.fn(() => new Promise<{ reviewId: string }>(() => {}));
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview }));

    // Let the menu's autofocus rAF land first, or it steals the focus this
    // test is about to rest on the sidebar row.
    await waitFor(() => expect(screen.getByRole("menu")).toHaveFocus());

    // Rest focus on the sidebar's provider row, the pane the start is about to
    // turn inert; the click's own navigation lands in the prop mock.
    const providerRow = screen.getByRole("button", { name: "Configure provider settings" });
    await user.click(providerRow);
    expect(providerRow).toHaveFocus();

    await user.keyboard("r");

    await waitFor(() => expect(createReview).toHaveBeenCalled());
    // Focus custody: the menu takes the focus the inert sidebar would have
    // dropped — the active element never falls to the body.
    expect(screen.getByRole("menu")).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("keeps focus custody when the start from the sidebar is consent-gated", async () => {
    const createReview = vi.fn(() => new Promise<{ reviewId: string }>(() => {}));
    const user = userEvent.setup();
    renderConsentGatedHome(buildProps({ createReview }));

    // Let the menu's autofocus rAF land first, or it steals the focus this
    // test is about to rest on the sidebar row.
    await waitFor(() => expect(screen.getByRole("menu")).toHaveFocus());

    const providerRow = screen.getByRole("button", { name: "Configure provider settings" });
    await user.click(providerRow);
    expect(providerRow).toHaveFocus();

    await user.keyboard("r");

    // Custody moved to the menu before the notice opened, so the notice
    // captured the menu — not the sidebar row. Declining proves it: the row is
    // still focusable (a dropped start turns nothing inert), so only the
    // hand-off can explain the restore landing on the menu.
    let notice = await screen.findByRole("alertdialog", { name: "Provider data notice" });
    await user.click(within(notice).getByRole("button", { name: "Not now" }));

    expect(createReview).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("menu")).toHaveFocus());

    // Accepting the re-raised notice continues the start, which turns the
    // sidebar inert — focus still never drops to the body.
    await user.keyboard("r");
    notice = await screen.findByRole("alertdialog", { name: "Provider data notice" });
    await user.click(within(notice).getByRole("button", { name: "Accept and continue" }));

    await waitFor(() => expect(createReview).toHaveBeenCalledWith({ mode: "unstaged" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("menu")).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
  });

  it("puts the run state on the started row, not on the highlighted one", async () => {
    const createReview = vi.fn(() => new Promise<{ reviewId: string }>(() => {}));
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview, highlighted: "review-unstaged" }));

    // Shift+R starts the staged review while the highlight sits on the unstaged
    // row: the run state must follow what was activated.
    await user.keyboard("{Shift>}R{/Shift}");

    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Review Staged" })).toHaveTextContent(
        /starting/i,
      ),
    );
    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).not.toHaveTextContent(
      /starting/i,
    );
  });
});

describe("HomePagePresentation — invalid review id toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("reports every invalid review link in a session, not only the first", async () => {
    const navigateMock = createNavigateMock();
    const props = buildProps({
      searchError: "invalid-review-id",
      navigate: navigateMock.navigate,
    });
    const { rerender } = renderPresentation(props);

    expect(await screen.findByText("Invalid Review ID")).toBeInTheDocument();
    expect(navigateMock.mock).toHaveBeenCalledTimes(1);

    // The redirect strips ?error=invalid-review-id; opening a second bad link
    // puts it back, and that one must be reported and cleaned too.
    rerender(<HomePagePresentation {...props} searchError={undefined} />);
    rerender(<HomePagePresentation {...props} />);

    await waitFor(() => expect(screen.getAllByText("Invalid Review ID")).toHaveLength(2));
    expect(navigateMock.mock).toHaveBeenCalledTimes(2);
    expect(navigateMock.mock).toHaveBeenLastCalledWith(
      expect.objectContaining({ replace: true, to: "/" }),
    );
  });
});

describe("HomePagePresentation — quit result surfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

describe("HomePagePresentation — menu jump keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts an unstaged review from the advertised r key", async () => {
    const createReview = vi.fn(async () => ({ reviewId: "rev-new" }));
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview }));

    await user.keyboard("r");

    await waitFor(() => expect(createReview).toHaveBeenCalledWith({ mode: "unstaged" }));
  });

  it("starts a staged review from the advertised shifted R key", async () => {
    const createReview = vi.fn(async () => ({ reviewId: "rev-new" }));
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview }));

    await user.keyboard("{Shift>}R{/Shift}");

    await waitFor(() => expect(createReview).toHaveBeenCalledWith({ mode: "staged" }));
  });

  it("resumes the cached session from the advertised l key", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        resumableSession: { reviewId: "rev-unstaged", mode: "unstaged" },
        navigate: navigateMock.navigate,
      }),
    );

    await user.keyboard("l");

    expect(navigateMock.mock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-unstaged" },
      }),
    );
  });

  it("opens the last run from the advertised o key", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        context: { ...baseContext, lastRunId: "rev-last", lastRunIssueCount: 4 },
        navigate: navigateMock.navigate,
      }),
    );

    await user.keyboard("o");

    expect(navigateMock.mock).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "rev-last" },
    });
  });

  it("opens provider settings from the advertised p key", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(buildProps({ navigate: navigateMock.navigate }));

    await user.keyboard("p");

    expect(navigateMock.mock).toHaveBeenCalledWith({ to: "/settings/providers" });
  });

  it("opens trust permissions from the advertised t key while untrusted", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(buildProps({ isTrusted: false, navigate: navigateMock.navigate }));

    await user.keyboard("t");

    expect(navigateMock.mock).toHaveBeenCalledWith({ to: "/settings/trust-permissions" });
  });

  it("holds the sidebar jump keys while a review is starting", async () => {
    const createReview = vi.fn(() => new Promise<{ reviewId: string }>(() => {}));
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview, navigate: navigateMock.navigate }));

    await user.keyboard("r");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/starting review/i));
    await user.keyboard("p");

    expect(navigateMock.mock).not.toHaveBeenCalled();
  });

  it("declines t once the repository is trusted instead of swallowing it", async () => {
    const navigateMock = createNavigateMock();
    const onFallthrough = vi.fn();
    const user = userEvent.setup();
    // Registered first, so it sits behind home's own binding in the dispatch
    // order and only runs if home declines the key.
    render(
      <>
        <TrustKeyProbe onPress={onFallthrough} />
        <HomePagePresentation {...buildProps({ navigate: navigateMock.navigate })} />
      </>,
      { wrapper: Wrapper },
    );

    await user.keyboard("t");

    expect(navigateMock.mock).not.toHaveBeenCalled();
    expect(onFallthrough).toHaveBeenCalledOnce();
  });

  it("leaves o inert when there is no previous run", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(buildProps({ navigate: navigateMock.navigate }));

    await user.keyboard("o");

    expect(navigateMock.mock).not.toHaveBeenCalled();
  });

  it("ignores the jump keys of items the menu renders as disabled", async () => {
    const createReview = vi.fn(async () => ({ reviewId: "rev-new" }));
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    // Untrusted disables both review starts; no resumable session disables resume.
    renderPresentation(
      buildProps({ isTrusted: false, createReview, navigate: navigateMock.navigate }),
    );

    await user.keyboard("r");
    await user.keyboard("{Shift>}R{/Shift}");
    await user.keyboard("l");

    expect(createReview).not.toHaveBeenCalled();
    expect(navigateMock.mock).not.toHaveBeenCalled();
    expect(screen.queryByText("Repository Not Trusted")).not.toBeInTheDocument();
  });
});
