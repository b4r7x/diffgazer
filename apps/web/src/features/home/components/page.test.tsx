import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { ActiveReviewSession, CreateReviewResponse } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import {
  makeActiveReviewSession,
  makeCreateReviewResponse,
} from "@diffgazer/core/testing/factories";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { ProviderConsentProvider } from "@/hooks/use-provider-consent";
import { makeShellApiOverrides, makeShellInitResponse } from "@/testing/shell-fixtures";
import { drainToasts } from "@/testing/toast-fixtures";

type ActiveSessionState = ActiveReviewSession | null;

const mockNavigate = vi.fn();
const shellInit = makeShellInitResponse();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({}),
  useLocation: () => ({ pathname: "/" }),
}));

import { HomePage } from "./page";

let mockGetReviews: Mock<BoundApi["getReviews"]>;
let mockGetActiveReviewSession: Mock<BoundApi["getActiveReviewSession"]>;
let mockCreateReview: Mock<BoundApi["createReview"]>;

let unstagedActiveSession: ActiveSessionState = null;
let stagedActiveSession: ActiveSessionState = null;

function setActiveSessions(unstaged: ActiveSessionState, staged: ActiveSessionState) {
  unstagedActiveSession = unstaged;
  stagedActiveSession = staged;
}

function createTestApi(init = shellInit): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    ...makeShellApiOverrides(init),
    getReviews: mockGetReviews,
    getActiveReviewSession: mockGetActiveReviewSession,
    createReview: mockCreateReview,
  } satisfies BoundApi;
}

function renderHomePage(api = createTestApi()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <FooterProvider>
              <KeyboardProvider>
                <ProviderConsentProvider>
                  {children}
                  <Toaster />
                </ProviderConsentProvider>
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
  beforeEach(async () => {
    await drainToasts();
    mockNavigate.mockReset();
    setActiveSessions(null, null);

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

  it("asks for the provider consent before the first review and starts it once accepted", async () => {
    const user = userEvent.setup();
    const init = makeShellInitResponse();
    init.settings.providerConsent = null;
    const api = createTestApi(init);
    api.saveSettings = vi.fn(async (patch) => {
      Object.assign(init.settings, patch);
    });
    renderHomePage(api);

    await user.click(await screen.findByRole("menuitem", { name: "Review Unstaged" }));

    const dialog = screen.getByRole("alertdialog", { name: "Provider data notice" });
    expect(mockCreateReview).not.toHaveBeenCalled();
    // The r accelerator is the notice's while it is up: no second start behind it.
    await user.keyboard("r");
    expect(mockCreateReview).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Accept and continue" }));

    await waitFor(() => expect(mockCreateReview).toHaveBeenCalledWith({ mode: "unstaged" }));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "/review/{-$reviewId}" }),
      ),
    );
    expect(api.saveSettings).toHaveBeenCalledOnce();
  });

  it("opens the running review the server refused the start for", async () => {
    const user = userEvent.setup();
    const running = makeActiveReviewSession({
      reviewId: "22222222-2222-4222-8222-222222222222",
      mode: "unstaged",
    });
    // The server refuses because that review is live, and the active-session
    // endpoint reports it from that moment on — nothing was resumable at mount.
    mockCreateReview.mockImplementation(async () => {
      setActiveSessions(running, null);
      const refusal = new Error("A review is already running") as Error & {
        status: number;
        code: string;
      };
      refusal.status = 409;
      refusal.code = "REVIEW_IN_PROGRESS";
      throw refusal;
    });
    renderHomePage();

    await user.click(await screen.findByRole("menuitem", { name: "Review Unstaged" }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/review/{-$reviewId}",
        params: { reviewId: running.reviewId },
        search: { mode: "unstaged", live: true },
      }),
    );
    expect(await screen.findByText("Opened the Running Review")).toBeInTheDocument();
  });

  it("offers the running review of the other mode the server refused the start for", async () => {
    const user = userEvent.setup();
    const running = makeActiveReviewSession({
      reviewId: "33333333-3333-4333-8333-333333333333",
      mode: "staged",
    });
    // The live review covers staged changes, so the unstaged re-read reports
    // nothing: only re-reading both modes can name the review that refused it.
    mockCreateReview.mockImplementation(async () => {
      setActiveSessions(null, running);
      const refusal = new Error("A review is already running") as Error & {
        status: number;
        code: string;
      };
      refusal.status = 409;
      refusal.code = "REVIEW_IN_PROGRESS";
      throw refusal;
    });
    renderHomePage();

    await user.click(await screen.findByRole("menuitem", { name: "Review Unstaged" }));

    await user.click(await screen.findByRole("button", { name: "Open Running Review" }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: running.reviewId },
      search: { mode: "staged", live: true },
    });
  });

  it("cycles Tab between the menu and the context pane", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const menu = await screen.findByRole("menu");
    const providerRow = screen.getByRole("button", { name: "Configure provider settings" });
    await waitFor(() => expect(menu).toHaveFocus());

    await user.tab();
    await waitFor(() => expect(providerRow).toHaveFocus());

    await user.tab();
    await waitFor(() => expect(menu).toHaveFocus());
  });

  it("keeps trusted home actions when configuration init succeeds", async () => {
    renderHomePage();

    expect(await screen.findByRole("menuitem", { name: "Review Unstaged" })).toBeInTheDocument();
    expect(screen.queryByText("Trust This Repository?")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a configuration error instead of untrusted defaults when init fails", async () => {
    const api = createTestApi();
    vi.mocked(api.loadConfigurationInit).mockRejectedValue(new Error("init unavailable"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <FooterProvider>
              <KeyboardProvider>
                <ProviderConsentProvider>
                  <HomePage />
                </ProviderConsentProvider>
              </KeyboardProvider>
            </FooterProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Configuration Unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
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

  // The chrome names the model the way the catalog publishes it, so the home
  // context line reads the same words as the header and the review meta.
  it("renders selected configuration identity without legacy provider flags", async () => {
    const { container } = renderHomePage();
    await screen.findByRole("menuitem", { name: "Review Unstaged" });
    expect(screen.getByText("Google Gemini (Gemini 2.5 Flash)")).toBeInTheDocument();
    expect(container.innerHTML).toBeClientSafeDom();
  });
});
