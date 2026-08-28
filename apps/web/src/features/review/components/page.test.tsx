import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { formatRunId } from "@diffgazer/core/format";
import { createInitialReviewState, reviewReducer } from "@diffgazer/core/review";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import {
  configurationStatus,
  makeConfigurationInitResponse,
  makeReadyInitResponse,
  ZAI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster, toast } from "@diffgazer/ui/components/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { ProviderConsentProvider } from "@/hooks/use-provider-consent";
import { assertClientSafePayload } from "@/testing/client-safe-assertions";
import { makeReviewLifecycleBase } from "../testing/review-lifecycle-base";

type ReviewQueryState =
  | { status: "pending" }
  | { status: "success"; data?: unknown }
  | { status: "error"; error: unknown };

const {
  mockBack,
  mockClearActiveSession,
  mockNavigate,
  mockUseReview,
  mockUseReviewLifecycleBase,
  routeState,
} = vi.hoisted(() => ({
  mockBack: vi.fn(),
  mockClearActiveSession: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseReview: vi.fn(),
  mockUseReviewLifecycleBase: vi.fn(),
  routeState: {
    canGoBack: false,
    params: {} as { reviewId?: string },
    pathname: "/review/test-id",
    search: {} as { mode?: ReviewMode; live?: boolean; issueId?: string },
  },
}));

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => routeState.params,
  useRouter: () => ({
    history: {
      back: mockBack,
    },
    navigate: mockNavigate,
  }),
  useSearch: () => routeState.search,
  useCanGoBack: () => routeState.canGoBack,
  useLocation: () => ({ pathname: routeState.pathname }),
}));

// Boundary mock: api/hooks is the HTTP-data fetch boundary; we provide canned data and assert on the resulting UI.
vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  const { makeCreateReviewResponse } = await import("@diffgazer/core/testing/factories");

  return {
    ...actual,
    useReview: mockUseReview,
    useReviewLifecycleBase: mockUseReviewLifecycleBase,
    useReviewSessionCache: () => ({
      clearActiveSession: mockClearActiveSession,
    }),
    useCreateReview: () => ({
      mutateAsync: vi.fn(async ({ mode }: { mode: ReviewMode }) =>
        makeCreateReviewResponse({ reviewId: "rev-alternate", session: { mode } }),
      ),
    }),
  };
});

import { ReviewPage } from "./page";

function reviewQuery(state: ReviewQueryState = { status: "pending" }): ReviewQueryState {
  return state;
}

const EMPTY_REVIEW_METADATA = {
  id: "review-empty",
  durationMs: 2500,
  mode: "staged" as const,
  fileCount: 4,
  lenses: ["correctness", "tests"],
  createdAt: "2026-08-26T09:14:00.000Z",
};

/** A completed run that found nothing: the clean state's fixture. */
function emptyReviewQuery(): ReviewQueryState {
  return reviewQuery({
    status: "success",
    data: { review: { metadata: EMPTY_REVIEW_METADATA, result: { issues: [] } } },
  });
}

function apiError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function createMockApi(init = makeReadyInitResponse()): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    loadConfigurationInit: vi.fn().mockResolvedValue(init),
    listConfigurations: vi.fn().mockResolvedValue({
      schemaVersion: 2,
      configurations: init.configurations,
      selectedConfigurationId: init.selectedConfigurationId,
    }),
    inspectConfiguration: vi.fn(),
    selectConfiguration: vi.fn(),
    testConfiguration: vi.fn(),
    updateConfiguration: vi.fn(),
    deleteConfiguration: vi.fn(),
    executeConfigurationAction: vi.fn(),
    createConfiguration: vi.fn(),
  };
}

function renderPage({
  strict = false,
  init = makeReadyInitResponse(),
}: {
  strict?: boolean;
  init?: ReturnType<typeof makeReadyInitResponse>;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const api = createMockApi(init);

  function Wrapper({ children }: { children: ReactNode }) {
    const tree = (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <KeyboardProvider>
              <ProviderConsentProvider>
                <FooterProvider>
                  {children}
                  <Toaster />
                </FooterProvider>
              </ProviderConsentProvider>
            </KeyboardProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>
    );

    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  }

  return render(<ReviewPage />, { wrapper: Wrapper });
}

function resetReviewMocks() {
  toast.dismiss();
  routeState.params = {};
  routeState.canGoBack = false;
  routeState.pathname = "/review/test-id";
  routeState.search = {};
  mockBack.mockReset();
  mockClearActiveSession.mockReset();
  mockNavigate.mockReset();
  mockNavigate.mockResolvedValue(undefined);
  mockUseReview.mockReset();
  mockUseReview.mockReturnValue(reviewQuery());
  mockUseReviewLifecycleBase.mockReset();
  mockUseReviewLifecycleBase.mockReturnValue(
    makeReviewLifecycleBase({ stream: { state: { isStreaming: true } } }),
  );
}

describe("ReviewPage saved review loading", () => {
  beforeEach(resetReviewMocks);

  it("shows a saved review loading message while the saved review is loading", () => {
    routeState.params = { reviewId: "review-loading" };

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading review...");
  });

  it("renders the durable terminal receipt for a saved review that never completed", async () => {
    routeState.params = { reviewId: "review-cancelled" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-cancelled" },
            result: { issues: [] },
            executionSnapshot: {
              schemaVersion: 1,
              executionFingerprint: "a".repeat(64),
              receipt: { outcome: "budget-exhausted", usageAvailability: "unavailable" },
            },
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Budget Exhausted");
    expect(screen.getByText(/Usage unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/Review Complete/)).not.toBeInTheDocument();
  });

  it("opens a budget-exhausted run with a completed lens into the failure-mode summary", async () => {
    const user = userEvent.setup();
    const issue = makeIssue({ id: "issue-1", title: "Kept finding" });
    routeState.params = { reviewId: "review-budget" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-budget" },
            result: { issues: [issue] },
            lensStats: [
              { lensId: "correctness", issueCount: 1, status: "success" },
              {
                lensId: "security",
                issueCount: 0,
                status: "failed",
                errorCode: "BUDGET_EXHAUSTED",
              },
              { lensId: "tests", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
            ],
            executionSnapshot: {
              schemaVersion: 1,
              executionFingerprint: "a".repeat(64),
              receipt: { outcome: "budget-exhausted", usageAvailability: "reported" },
            },
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Budget Exhausted");
    expect(screen.getByText("1 of 3 lenses completed · 1 issue")).toBeVisible();
    expect(screen.queryByText(/Review Complete/)).not.toBeInTheDocument();

    // The findings the run did produce are still a results screen away.
    await user.click(screen.getByRole("button", { name: /view results/i }));
    expect(await screen.findByText(`Review ${formatRunId("review-budget")}`)).toBeInTheDocument();
  });

  it("keeps the failure story on a deep link into a failed run's findings", async () => {
    const user = userEvent.setup();
    const issue = makeIssue({ id: "issue-1", title: "Kept finding" });
    routeState.params = { reviewId: "review-budget" };
    routeState.search = { mode: "staged", issueId: "issue-1" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-budget" },
            result: { issues: [issue] },
            lensStats: [
              { lensId: "correctness", issueCount: 1, status: "success" },
              {
                lensId: "security",
                issueCount: 0,
                status: "failed",
                errorCode: "BUDGET_EXHAUSTED",
              },
            ],
            executionSnapshot: {
              schemaVersion: 1,
              executionFingerprint: "a".repeat(64),
              receipt: { outcome: "budget-exhausted", usageAvailability: "reported" },
            },
          },
        },
      }),
    );

    renderPage();

    // The history insights list links straight to a finding, skipping the
    // summary - so the results screen has to carry the outcome itself.
    expect(await screen.findByRole("option", { name: /kept finding/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Budget Exhausted");

    // And the summary the link skipped stays reachable rather than being the one
    // screen this run can never show. A deep link opens in the details zone, so
    // the first Escape steps to the list and the second leaves the results.
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");

    expect(await screen.findByRole("button", { name: /view results/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Budget Exhausted");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("keeps the durable receipt for a terminal run whose lenses all failed", async () => {
    routeState.params = { reviewId: "review-failed" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-failed" },
            result: { issues: [] },
            lensStats: [
              { lensId: "correctness", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
            ],
            executionSnapshot: {
              schemaVersion: 1,
              executionFingerprint: "a".repeat(64),
              receipt: { outcome: "transport-failed", usageAvailability: "unavailable" },
            },
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Transport Failed");
    expect(screen.queryByRole("button", { name: /view results/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeInTheDocument();
  });

  it("opens a completed saved review at its findings instead of its summary", async () => {
    const issue = makeIssue({
      id: "issue-1",
      title: "Saved result issue",
      symptom: "Saved result issue symptom",
    });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-saved", durationMs: 2500 },
            result: {
              issues: [issue],
            },
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByText(`Review ${formatRunId("review-saved")}`)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /saved result issue/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Saved result issue symptom")).toBeInTheDocument();
    expect(screen.queryByText("Review Complete")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("opens a completed saved review that found nothing at its clean-run state", async () => {
    const user = userEvent.setup();
    routeState.params = { reviewId: "review-empty" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(emptyReviewQuery());

    renderPage();

    expect(await screen.findByText("Passed — no issues found")).toBeInTheDocument();
    expect(screen.getByText("Staged · 4 files")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    // No entry into emptiness: the run offers where to go next, not a results
    // screen with nothing in it.
    expect(screen.queryByRole("button", { name: /view results/i })).not.toBeInTheDocument();
    const backToHistory = screen.getByRole("button", { name: "Back to History" });
    expect(screen.getAllByRole("button")).toEqual([backToHistory]);

    await user.click(backToHistory);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/history" });
  });

  it("keeps a zero-issue run on its clean state for an issue deep link", async () => {
    routeState.params = { reviewId: "review-empty" };
    routeState.search = { mode: "staged", issueId: "issue-1" };
    mockUseReview.mockReturnValue(emptyReviewQuery());

    renderPage();

    expect(await screen.findByText("Passed — no issues found")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("keeps a zero-issue run on its clean state once the results screen was entered", async () => {
    const user = userEvent.setup();
    routeState.params = { reviewId: "review-empty" };
    routeState.search = { mode: "staged" };
    // The only way into `savedScreen: "results"` is a summary's View Results,
    // and only a failed run renders that summary with findings behind it.
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: EMPTY_REVIEW_METADATA,
            result: { issues: [makeIssue({ id: "issue-1", title: "Wrong value" })] },
            lensStats: [
              { lensId: "correctness", issueCount: 1, status: "success" },
              { lensId: "security", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
            ],
            executionSnapshot: {
              schemaVersion: 1,
              executionFingerprint: "a".repeat(64),
              receipt: { outcome: "budget-exhausted", usageAvailability: "reported" },
            },
          },
        },
      }),
    );

    const { rerender } = renderPage();
    await user.click(await screen.findByRole("button", { name: /view results/i }));
    expect(screen.getByRole("option", { name: /wrong value/i })).toBeInTheDocument();

    // The same run re-read as a completed one that found nothing: a screen
    // state of "results" is not a way into an empty list.
    mockUseReview.mockReturnValue(emptyReviewQuery());
    rerender(<ReviewPage />);

    expect(await screen.findByText("Passed — no issues found")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("returns straight to History with Escape from an auto-landed results list", async () => {
    const user = userEvent.setup();
    routeState.canGoBack = true;
    const issue = makeIssue({ id: "issue-1", title: "Saved result issue" });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-saved" },
            result: { issues: [issue] },
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByText(`Review ${formatRunId("review-saved")}`)).toBeInTheDocument();

    // Opening the run was one step from History, so Escape is one step back -
    // no summary stop in between.
    await user.keyboard("{Escape}");

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Review Complete")).not.toBeInTheDocument();
  });

  it("returns a summary-entered results list to its summary with Escape", async () => {
    const user = userEvent.setup();
    const issue = makeIssue({ id: "issue-1", title: "Kept finding" });
    routeState.params = { reviewId: "review-budget" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-budget", durationMs: 2500 },
            result: { issues: [issue] },
            lensStats: [
              { lensId: "correctness", issueCount: 1, status: "success" },
              { lensId: "tests", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
            ],
            executionSnapshot: {
              schemaVersion: 1,
              executionFingerprint: "a".repeat(64),
              receipt: { outcome: "budget-exhausted", usageAvailability: "reported" },
            },
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Budget Exhausted");

    await user.click(screen.getByRole("button", { name: /view results/i }));

    expect(await screen.findByText(`Review ${formatRunId("review-budget")}`)).toBeInTheDocument();

    // Results opened from a summary keep it one keystroke away.
    await user.keyboard("{Escape}");

    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent("Budget Exhausted");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("keeps Escape leaving the screen for a summary-less issue deep link", async () => {
    const user = userEvent.setup();
    const issue = makeIssue({ id: "issue-1", title: "Linked saved issue" });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged", issueId: "issue-1" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-saved" },
            result: { issues: [issue] },
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("option", { name: /linked saved issue/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // A deep link opens in the details zone; the first Escape steps to the list.
    await user.keyboard("{Escape}");
    expect(mockNavigate).not.toHaveBeenCalled();

    // The deep link skipped the summary, so the next Escape leaves the screen.
    await user.keyboard("{Escape}");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("opens a valid saved-review issue deep link directly in results", async () => {
    const firstIssue = makeIssue({
      id: "issue-1",
      title: "First saved issue",
      symptom: "First saved symptom",
    });
    const linkedIssue = makeIssue({
      id: "issue-2",
      title: "Linked saved issue",
      symptom: "Linked saved symptom",
    });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged", issueId: "issue-2" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-saved" },
            result: { issues: [firstIssue, linkedIssue] },
            droppedDuplicates: 1,
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("option", { name: /linked saved issue/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Linked saved symptom")).toBeInTheDocument();
    expect(screen.queryByText("Review Complete")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "1 duplicate issue collapsed across lenses (3 → 2 issues)",
    );
  });

  it("treats an invalid saved-review issue deep link as no deep link at all", async () => {
    const user = userEvent.setup();
    const firstIssue = makeIssue({ id: "issue-1", title: "First saved issue" });
    const secondIssue = makeIssue({ id: "issue-2", title: "Second saved issue" });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged", issueId: "missing-issue" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-saved" },
            result: { issues: [firstIssue, secondIssue] },
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("option", { name: /first saved issue/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // No deep link means the auto landing: Escape leaves for History directly.
    await user.keyboard("{Escape}");

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("explains persisted duplicate collapse in a reopened review", async () => {
    const issue = makeIssue({ id: "issue-1", title: "Saved result issue" });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-saved" },
            result: { issues: [issue] },
            droppedDuplicates: 1,
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("note")).toHaveTextContent(
      "1 duplicate issue collapsed across lenses (2 → 1 issue)",
    );
  });

  it("keeps a routed live review streaming instead of loading it from history", async () => {
    const reviewId = "11111111-1111-4111-8111-111111111111";
    routeState.params = { reviewId };
    routeState.search = { mode: "unstaged", live: true };
    mockUseReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ stream: { state: { reviewId, isStreaming: true } } }),
    );

    renderPage();

    expect(await screen.findByRole("region", { name: "Progress" })).toBeInTheDocument();
  });

  it("streams when the saved review returns 404", async () => {
    routeState.params = { reviewId: "missing-review" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "error",
        error: apiError(404),
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("streams when the saved review has no result", async () => {
    routeState.params = { reviewId: "unfinished-review" };
    routeState.search = { mode: "unstaged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "unfinished-review" },
            result: null,
          },
        },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports saved review errors without replacing the route", async () => {
    routeState.params = { reviewId: "broken-review" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "error",
        error: apiError(500),
      }),
    );

    renderPage();

    const errorToast = await screen.findByRole("alert");
    expect(errorToast).toHaveTextContent(/error loading review/i);
    expect(errorToast).toHaveTextContent("HTTP 500");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "/review/{-$reviewId}" }),
    );
  });

  it("reports a saved review error exactly once when the report effect re-runs", async () => {
    routeState.params = { reviewId: "broken-review" };
    routeState.search = { mode: "staged" };
    // A fresh error object every render makes the report effect's dependency change
    // identity, so without the fired-once ref guard handleApiError (toast + home
    // redirect) would re-fire on each re-render.
    mockUseReview.mockImplementation(() => reviewQuery({ status: "error", error: apiError(500) }));

    const { rerender } = renderPage({ strict: true });

    const errorToast = await screen.findByRole("alert");
    expect(errorToast).toHaveTextContent(/error loading review/i);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });

    rerender(<ReviewPage />);
    rerender(<ReviewPage />);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(mockNavigate.mock.calls.filter(([arg]) => arg?.to === "/")).toHaveLength(1);
  });
});

describe("ReviewPage no-reviewId redirect", () => {
  beforeEach(resetReviewMocks);

  it("renders the redirect fallback when reviewId is missing", () => {
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Redirecting...");
  });
});

describe("ReviewPage stale live session falls back to saved review", () => {
  const STALE_REVIEW_ID = "33333333-3333-4333-8333-333333333333";

  interface CapturedCallbacks {
    onNotFoundInSession: ((reviewId: string) => void) | null;
  }

  let captured: CapturedCallbacks;

  beforeEach(() => {
    resetReviewMocks();
    captured = { onNotFoundInSession: null };
    routeState.params = { reviewId: STALE_REVIEW_ID };
    routeState.search = { mode: "staged", live: true };
    mockUseReviewLifecycleBase.mockImplementation(
      (opts: { onNotFoundInSession?: (id: string) => void }) => {
        captured.onNotFoundInSession = opts.onNotFoundInSession ?? null;
        return makeReviewLifecycleBase({
          stream: { state: { reviewId: STALE_REVIEW_ID, isStreaming: true } },
        });
      },
    );
  });

  it("falls back to saved review when live stream returns 404 and saved review exists", async () => {
    const savedIssue = makeIssue({
      id: "saved-1",
      title: "Saved fallback issue",
      symptom: "Saved fallback symptom",
    });
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: STALE_REVIEW_ID },
            result: { issues: [savedIssue] },
          },
        },
      }),
    );

    renderPage();

    expect(await screen.findByRole("region", { name: "Progress" })).toBeInTheDocument();

    await act(() => {
      captured.onNotFoundInSession?.(STALE_REVIEW_ID);
    });

    expect(await screen.findByText(`Review ${formatRunId(STALE_REVIEW_ID)}`)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /saved fallback issue/i })).toBeInTheDocument();
    expect(mockClearActiveSession).toHaveBeenCalledWith("staged", STALE_REVIEW_ID);
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: "/" });
  });

  it("shows error toast and navigates home when both stream and saved review return 404", async () => {
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "error",
        error: apiError(404),
      }),
    );

    renderPage();

    expect(await screen.findByRole("region", { name: "Progress" })).toBeInTheDocument();

    await act(() => {
      captured.onNotFoundInSession?.(STALE_REVIEW_ID);
    });

    const errorToast = await screen.findByRole("alert");
    expect(errorToast).toHaveTextContent(/live session has expired/i);
    expect(mockClearActiveSession).toHaveBeenCalledWith("staged", STALE_REVIEW_ID);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });
});

describe("ReviewPage reviewId changes", () => {
  const FIRST_REVIEW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const SECOND_REVIEW_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  beforeEach(() => {
    resetReviewMocks();
    routeState.search = { mode: "unstaged", live: true };
  });

  it("does not keep the previous live review results when reviewId changes", async () => {
    const firstIssue = makeIssue({
      id: "first-issue",
      title: "First review issue",
      symptom: "First review symptom",
    });

    let capturedOnComplete: (() => void) | null = null;
    routeState.params = { reviewId: FIRST_REVIEW_ID };

    mockUseReviewLifecycleBase.mockImplementation((opts: { onComplete?: () => void }) => {
      capturedOnComplete = opts.onComplete ?? null;
      return makeReviewLifecycleBase({
        stream: { state: { reviewId: FIRST_REVIEW_ID, issues: [firstIssue], isStreaming: true } },
      });
    });

    const view = renderPage();

    await act(() => {
      capturedOnComplete?.();
    });
    expect(await screen.findByText("Review Complete")).toBeInTheDocument();
    expect(mockClearActiveSession).toHaveBeenCalledWith("unstaged", FIRST_REVIEW_ID);

    routeState.params = { reviewId: SECOND_REVIEW_ID };
    mockUseReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        stream: { state: { reviewId: SECOND_REVIEW_ID, isStreaming: true } },
      }),
    );

    view.rerender(<ReviewPage />);

    expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();
    expect(screen.queryByText("Review Complete")).not.toBeInTheDocument();
    expect(screen.queryByText("First review issue")).not.toBeInTheDocument();
  });
});

describe("ReviewPage live review phase transitions", () => {
  const LIVE_REVIEW_ID = "22222222-2222-4222-8222-222222222222";
  const liveIssueOne = makeIssue({
    id: "live-issue-1",
    title: "Live issue one",
    file: "src/a.ts",
    category: "correctness",
  });
  const liveIssueTwo = makeIssue({
    id: "live-issue-2",
    title: "Live issue two",
    file: "src/b.ts",
    category: "security",
  });
  const completedIssues = [liveIssueOne, liveIssueTwo];
  const streamedDuplicate = makeIssue({
    id: "live-issue-duplicate",
    title: "Live issue duplicate",
    file: "src/a.ts",
    category: "correctness",
  });

  let capturedOnComplete: (() => void) | null;

  beforeEach(() => {
    resetReviewMocks();
    capturedOnComplete = null;
    routeState.params = { reviewId: LIVE_REVIEW_ID };
    routeState.search = { mode: "unstaged", live: true };
    const issueEvents = [
      {
        type: "issue_found" as const,
        agent: "detective" as const,
        issue: liveIssueOne,
        timestamp: "2026-01-01T00:00:00.000Z",
      },
      {
        type: "issue_found" as const,
        agent: "guardian" as const,
        issue: liveIssueTwo,
        timestamp: "2026-01-01T00:00:01.000Z",
      },
      {
        type: "issue_found" as const,
        agent: "tester" as const,
        issue: streamedDuplicate,
        timestamp: "2026-01-01T00:00:02.000Z",
      },
    ];
    const streamedState = issueEvents.reduce(
      (state, event) => reviewReducer(state, { type: "EVENT", event }),
      reviewReducer(createInitialReviewState(), { type: "START" }),
    );
    const completedEventState = reviewReducer(streamedState, {
      type: "EVENT",
      event: {
        type: "orchestrator_complete",
        totalIssues: 2,
        lensStats: [
          { lensId: "correctness", issueCount: 2, status: "success" },
          { lensId: "security", issueCount: 1, status: "success" },
        ],
        filesAnalyzed: 2,
        droppedDuplicates: 1,
        timestamp: "2026-01-01T00:00:03.000Z",
      },
    });
    const completedState = reviewReducer(completedEventState, {
      type: "COMPLETE_WITH_RESULT",
      issues: completedIssues,
    });
    mockUseReviewLifecycleBase.mockImplementation((opts: { onComplete?: () => void }) => {
      capturedOnComplete = opts.onComplete ?? null;
      return makeReviewLifecycleBase({
        stream: { state: { ...completedState, reviewId: LIVE_REVIEW_ID } },
      });
    });
  });

  it("carries the live duplicate-collapse count into the summary", async () => {
    renderPage();

    await act(() => {
      capturedOnComplete?.();
    });

    expect(await screen.findByText(/^2 issues in /)).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent(
      "1 duplicate issue collapsed across lenses (3 → 2 issues)",
    );
  });

  it("progresses from streaming through summary to results when review completes", async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByRole("region", { name: "Progress" })).toBeInTheDocument();

    await act(() => {
      capturedOnComplete?.();
    });

    expect(await screen.findByText("Review Complete")).toBeInTheDocument();
    expect(mockClearActiveSession).toHaveBeenCalledWith("unstaged", LIVE_REVIEW_ID);
    expect(screen.getByRole("button", { name: /view results/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view results/i }));

    expect(await screen.findByText(`Review ${formatRunId(LIVE_REVIEW_ID)}`)).toBeInTheDocument();
    expect(screen.queryByText("Review Complete")).not.toBeInTheDocument();
  });

  async function openSummary() {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("region", { name: "Progress" });
    await act(() => {
      capturedOnComplete?.();
    });
    expect(await screen.findByText("Review Complete")).toBeInTheDocument();
    return user;
  }

  // The summary screen's back affordances — the app header link and the Esc
  // shortcut — both run this handler.
  it("uses the safe home fallback for direct navigation via Escape", async () => {
    const user = await openSummary();

    await user.keyboard("{Escape}");

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("uses browser history when available via Escape", async () => {
    routeState.canGoBack = true;
    const user = await openSummary();

    await user.keyboard("{Escape}");

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("returns live results to the summary with Escape instead of leaving the route", async () => {
    routeState.canGoBack = true;
    const user = await openSummary();

    await user.click(screen.getByRole("button", { name: /view results/i }));
    expect(await screen.findByText(`Review ${formatRunId(LIVE_REVIEW_ID)}`)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(await screen.findByText("Review Complete")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("offers View Results as the summary's only action and no Back of its own", async () => {
    routeState.canGoBack = true;
    await openSummary();

    // Leaving the summary belongs to the header ← Back and Esc; a second Back
    // in the page pointed at the same target.
    expect(screen.getByRole("button", { name: /view results/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });
});

describe("ReviewPage protected route readiness", () => {
  beforeEach(resetReviewMocks);

  it("waits for readiness before starting a live review", async () => {
    const reviewId = "11111111-1111-4111-8111-111111111111";
    routeState.params = { reviewId };
    routeState.search = { mode: "unstaged", live: true };
    let capturedOptions: Parameters<typeof mockUseReviewLifecycleBase>[0] | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      capturedOptions = options;
      return makeReviewLifecycleBase({
        stream: { state: { reviewId, isStreaming: true } },
        checks: { loadingMessage: "Checking for changes..." },
        gate: "loading",
      });
    });

    renderPage();

    // The admitted run keeps the review surface from the first frame; the
    // centered readout is reserved for configuration we cannot resolve yet.
    expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();
    await waitFor(() => {
      expect(capturedOptions?.readiness?.ready).toBe(true);
      expect(capturedOptions?.readiness?.status).toBe("ready");
    });
  });

  it("sends the selected readiness into the review lifecycle without legacy secret fields", async () => {
    const reviewId = "11111111-1111-4111-8111-111111111111";
    routeState.params = { reviewId };
    routeState.search = { mode: "unstaged", live: true };
    let capturedOptions: Parameters<typeof mockUseReviewLifecycleBase>[0] | undefined;
    mockUseReviewLifecycleBase.mockImplementation((options) => {
      capturedOptions = options;
      return makeReviewLifecycleBase({ stream: { state: { reviewId, isStreaming: true } } });
    });

    renderPage();

    // The readiness hand-off itself is asserted above; here we only need the
    // payload to exist before the leak guard reads it.
    await waitFor(() => {
      expect(capturedOptions?.readiness).toBeDefined();
    });
    assertClientSafePayload(capturedOptions?.readiness, "readiness");
  });

  it("resumes a saved completed review without falsely re-gating setup", async () => {
    const issue = makeIssue({ id: "issue-1", title: "Saved result issue" });
    routeState.params = { reviewId: "review-saved" };
    routeState.search = { mode: "staged" };
    mockUseReview.mockReturnValue(
      reviewQuery({
        status: "success",
        data: {
          review: {
            metadata: { id: "review-saved" },
            result: { issues: [issue] },
          },
        },
      }),
    );
    mockUseReviewLifecycleBase.mockImplementation((_options) =>
      makeReviewLifecycleBase({ stream: { state: { isStreaming: true } } }),
    );

    renderPage({
      init: makeConfigurationInitResponse([
        configurationStatus(ZAI_CONFIGURATION, "conformance-failed"),
      ]),
    });

    expect(await screen.findByText(`Review ${formatRunId("review-saved")}`)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /saved result issue/i })).toBeInTheDocument();
    expect(screen.queryByText(/Configuration Not Ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/api key/i)).not.toBeInTheDocument();
  });
});
