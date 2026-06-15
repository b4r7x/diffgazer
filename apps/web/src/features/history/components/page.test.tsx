import { FooterProvider } from "@diffgazer/core/footer";
import type { InitResponse } from "@diffgazer/core/schemas/config";
import { makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";

const { mockNavigate, mockUseReview, mockUseReviews } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseReview: vi.fn(),
  mockUseReviews: vi.fn(),
}));

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/history-page-test" }),
  useNavigate: () => mockNavigate,
}));

// Boundary mock: @diffgazer/core/api/hooks wraps the HTTP data boundary; tests provide canned review query state.
vi.mock("@diffgazer/core/api/hooks", async () => {
  const actual = await vi.importActual<typeof import("@diffgazer/core/api/hooks")>(
    "@diffgazer/core/api/hooks",
  );

  return {
    ...actual,
    useReview: mockUseReview,
    useReviews: mockUseReviews,
  };
});

// Boundary mock: @diffgazer/core/review consumes fetch-backed review hooks; this test drives canned review query data.
vi.mock("@diffgazer/core/review", async () => {
  const actual =
    await vi.importActual<typeof import("@diffgazer/core/review")>("@diffgazer/core/review");
  return {
    ...actual,
    useHistoryScreenState: (
      options: {
        selectedRunId?: [string | null, (value: string | null) => void];
        selectedDateId?: [string, (value: string) => void];
        searchQuery?: [string, (value: string) => void];
      } = {},
    ) => {
      const reviewsQuery = mockUseReviews();
      const reviews = reviewsQuery.data?.reviews ?? [];
      const [rawRunId, setRawRunId] = options.selectedRunId ?? [null, () => {}];
      const [rawDateId, setRawDateId] = options.selectedDateId ?? ["all", () => {}];
      const [searchQuery, setRawSearchQuery] = options.searchQuery ?? ["", () => {}];

      const timelineItems = actual.buildTimelineItems(reviews);
      const selectedDateId = actual.resolveSelectedDateId(rawDateId, timelineItems);
      const filtered = actual.filterReviewsForHistory(reviews, selectedDateId, searchQuery);
      const mappedRuns = filtered.map(actual.buildHistoryRunSummary);
      const selectedRunId = actual.resolveSelectedId(rawRunId, mappedRuns);
      const selectedRun = reviews.find((r: { id: string }) => r.id === selectedRunId) ?? null;
      const detail = mockUseReview(selectedRunId ?? "");
      const sortedIssues = actual.sortIssuesBySeverity(detail.data?.review?.result?.issues);
      const hasReviews = reviews.length > 0;
      const hasSearchQuery = searchQuery.trim().length > 0;

      const resetSelectedRun = () => {
        if (rawRunId !== null) setRawRunId(null);
      };

      return {
        reviewsQuery,
        reviews,
        isLoading: reviewsQuery.isLoading,
        error: reviewsQuery.error?.message ?? null,
        timelineItems,
        selectedDateId,
        setSelectedDateId: (id: string) => {
          setRawDateId(id);
          resetSelectedRun();
        },
        searchQuery,
        setSearchQuery: (query: string) => {
          setRawSearchQuery(query);
          resetSelectedRun();
        },
        mappedRuns,
        selectedRunId,
        setSelectedRunId: setRawRunId,
        selectedRun,
        severityCounts: actual.metadataToSeverityCounts(selectedRun),
        sortedIssues,
        duration: "",
        hasReviews,
        hasSearchQuery,
        emptyRunsMessage: actual.getEmptyRunsMessage(hasReviews, hasSearchQuery, selectedDateId),
      };
    },
  };
});

import { HistoryPage } from "./page";

const SETTINGS_FIXTURE: InitResponse["settings"] = {
  theme: "terminal",
  defaultLenses: [],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: null,
  agentExecution: "parallel",
};

const PROVIDERS_FIXTURE: InitResponse["providers"] = [
  { provider: "gemini", hasApiKey: true, isActive: true },
];

function makeInitResponse(project: InitResponse["project"] = untrustedProject()): InitResponse {
  return {
    config: { provider: "gemini", model: "gemini-2.5-flash" },
    providers: PROVIDERS_FIXTURE,
    settings: SETTINGS_FIXTURE,
    configured: true,
    project,
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: project.trust !== null,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
  };
}

function trustedProject(): InitResponse["project"] {
  return {
    projectId: "proj-1",
    path: "/repo",
    trust: {
      projectId: "proj-1",
      repoRoot: "/repo",
      capabilities: { readFiles: true, runCommands: false },
      trustMode: "persistent" as const,
      trustedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function untrustedProject(): InitResponse["project"] {
  return {
    projectId: "proj-1",
    path: "/repo",
    trust: null,
  };
}

function defaultReviewsQuery() {
  return {
    data: {
      reviews: [
        makeReviewMetadata({ id: "11111111-1111-4111-8111-111111111111" }),
        makeReviewMetadata({ id: "22222222-2222-4222-8222-222222222222" }),
      ],
    },
    error: null,
    isLoading: false,
  };
}

let mockLoadInit: Mock<() => Promise<InitResponse>>;
let mockGetProviderStatus: Mock<() => Promise<InitResponse["providers"]>>;

function renderHistoryPage(ui: ReactNode = <HistoryPage />) {
  const { Wrapper: ApiWrapper, queryClient } = createTestQueryWrapper({
    api: {
      loadInit: mockLoadInit,
      getProviderStatus: mockGetProviderStatus,
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiWrapper>
        <ConfigProvider>
          <FooterProvider>
            <KeyboardProvider>{children}</KeyboardProvider>
          </FooterProvider>
        </ConfigProvider>
      </ApiWrapper>
    );
  }

  return { ...render(ui, { wrapper: Wrapper }), queryClient };
}

describe("HistoryPage trust workflow", () => {
  beforeEach(() => {
    mockLoadInit = vi.fn().mockResolvedValue(makeInitResponse(untrustedProject()));
    mockGetProviderStatus = vi.fn().mockResolvedValue(PROVIDERS_FIXTURE);
    mockUseReviews.mockReturnValue(defaultReviewsQuery());
    mockUseReview.mockReturnValue({
      data: { review: { result: { issues: [] } } },
      error: null,
      isLoading: false,
    });
  });

  it("shows the trust workflow on direct /history access before trust is granted", async () => {
    renderHistoryPage();

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search runs by id/i)).not.toBeInTheDocument();
  });

  it("shows history after trust is granted and returns to trust workflow when trust is revoked", async () => {
    mockLoadInit.mockResolvedValue(makeInitResponse(trustedProject()));
    const { queryClient } = renderHistoryPage();
    expect(await screen.findByPlaceholderText(/search runs by id/i)).toBeInTheDocument();

    await act(async () => {
      queryClient.setQueryData(["config", "init"], makeInitResponse(untrustedProject()));
    });

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search runs by id/i)).not.toBeInTheDocument();
  });

  it("does not surface raw TRUST_REQUIRED errors when trust is missing", async () => {
    mockUseReviews.mockReturnValue({
      data: undefined,
      error: Object.assign(new Error("Repository access not granted."), {
        code: "TRUST_REQUIRED",
        status: 403,
      }),
      isLoading: false,
    });

    renderHistoryPage();

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByText(/TRUST_REQUIRED/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/repository access not granted/i)).not.toBeInTheDocument();
  });
});

describe("HistoryPage loading and error status", () => {
  beforeEach(() => {
    mockLoadInit = vi.fn().mockResolvedValue(makeInitResponse(trustedProject()));
    mockGetProviderStatus = vi.fn().mockResolvedValue(PROVIDERS_FIXTURE);
    mockUseReview.mockReturnValue({
      data: { review: { result: { issues: [] } } },
      error: null,
      isLoading: false,
    });
  });

  it("announces the loading branch as a status region", () => {
    mockUseReviews.mockReturnValue({ data: undefined, error: null, isLoading: true });

    renderHistoryPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading runs...");
  });

  it("announces the error branch as an alert region", () => {
    mockUseReviews.mockReturnValue({
      data: undefined,
      error: new Error("disk unreadable"),
      isLoading: false,
    });

    renderHistoryPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Error: disk unreadable");
  });
});

describe("HistoryPage unreadable-review warnings", () => {
  beforeEach(() => {
    mockLoadInit = vi.fn().mockResolvedValue(makeInitResponse(trustedProject()));
    mockGetProviderStatus = vi.fn().mockResolvedValue(PROVIDERS_FIXTURE);
    mockUseReview.mockReturnValue({
      data: { review: { result: { issues: [] } } },
      error: null,
      isLoading: false,
    });
  });

  it("renders a non-blocking notice with the dropped-review count when warnings are present", () => {
    mockUseReviews.mockReturnValue({
      data: {
        reviews: [makeReviewMetadata({ id: "11111111-1111-4111-8111-111111111111" })],
        warnings: ["reviews/a.json: parse error", "reviews/b.json: parse error"],
      },
      error: null,
      isLoading: false,
    });

    renderHistoryPage();

    expect(screen.getByText(/2 saved reviews could not be read/i)).toBeInTheDocument();
  });

  it("renders nothing when the warnings array is empty or absent", () => {
    mockUseReviews.mockReturnValue(defaultReviewsQuery());

    renderHistoryPage();

    expect(screen.queryByText(/could not be read/i)).not.toBeInTheDocument();
  });
});

describe("HistoryPage empty-runs live region", () => {
  beforeEach(() => {
    mockLoadInit = vi.fn().mockResolvedValue(makeInitResponse(trustedProject()));
    mockGetProviderStatus = vi.fn().mockResolvedValue(PROVIDERS_FIXTURE);
    mockUseReview.mockReturnValue({
      data: { review: { result: { issues: [] } } },
      error: null,
      isLoading: false,
    });
  });

  it("keeps the live status region mounted across the runs→empty transition", () => {
    mockUseReviews.mockReturnValue(defaultReviewsQuery());
    const view = renderHistoryPage();

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent("");

    mockUseReviews.mockReturnValue({
      data: { reviews: [] },
      error: null,
      isLoading: false,
    });
    view.rerender(<HistoryPage />);

    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent("No runs yet");
  });
});

describe("HistoryPage keyboard navigation", () => {
  beforeEach(() => {
    clearScopedRouteState("/history-page-test", "date");
    clearScopedRouteState("/history-page-test", "run");
    mockLoadInit = vi.fn().mockResolvedValue(makeInitResponse(trustedProject()));
    mockGetProviderStatus = vi.fn().mockResolvedValue(PROVIDERS_FIXTURE);
    mockNavigate.mockReset();
    mockNavigate.mockResolvedValue(undefined);
    mockUseReviews.mockReset();
    mockUseReview.mockReset();
    mockUseReviews.mockReturnValue({
      data: {
        reviews: [
          makeReviewMetadata({ id: "11111111-1111-4111-8111-111111111111" }),
          makeReviewMetadata({ id: "22222222-2222-4222-8222-222222222222" }),
        ],
      },
      error: null,
      isLoading: false,
    });
    mockUseReview.mockReturnValue({
      data: {
        review: {
          result: {
            issues: [],
          },
        },
      },
      error: null,
      isLoading: false,
    });
  });

  it("moves focus from timeline to runs at the boundary and opens the highlighted run", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.click(screen.getByPlaceholderText(/search runs by id/i));
    await user.keyboard("{ArrowDown}");
    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{End}{ArrowDown}");
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("{ArrowDown}{Enter}");

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
    });
  });

  it("switches timeline keyboard behavior when clicking the selected section from runs", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await user.click(screen.getByRole("option", { name: "All" }));
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { name: "Feb 9" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the highlighted run with the open shortcut", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("{ArrowDown}o");

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
    });
  });

  it("focuses search with slash without typing slash into the field", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("/");

    const search = screen.getByPlaceholderText(/search runs by id/i);
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");
  });

  it("marks the active run with data-highlighted so theming can invert chip colors", async () => {
    mockUseReviews.mockReturnValue({
      data: {
        reviews: [
          makeReviewMetadata({
            id: "33333333-3333-4333-8333-333333333333",
            lowCount: 3,
            nitCount: 2,
            issueCount: 5,
          }),
        ],
      },
      error: null,
      isLoading: false,
    });

    renderHistoryPage();

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    const options = within(runsList).getAllByRole("option");
    const [activeRun] = options;
    if (activeRun === undefined) {
      throw new Error("Expected at least one review run option");
    }
    await waitFor(() => expect(activeRun).toHaveAttribute("data-highlighted"));

    expect(within(activeRun).getByText(/3 low/i)).toBeInTheDocument();
    expect(within(activeRun).getByText(/2 nit/i)).toBeInTheDocument();
  });

  it("never marks more than one panel as focused as Tab moves the focus zone", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    const focusedPanels = () => {
      const panels = [
        screen.getByRole("complementary", { name: "Review sections" }),
        screen.getByRole("listbox", { name: /review runs/i }),
        screen.getByRole("complementary", { name: "Review insights" }),
      ];
      return panels.filter((panel) => panel.matches(":focus-within"));
    };

    await waitFor(() => expect(focusedPanels().length).toBe(1));

    await user.keyboard("{Tab}");
    await waitFor(() => expect(focusedPanels().length).toBeLessThanOrEqual(1));

    await user.keyboard("{Tab}");
    await waitFor(() => expect(focusedPanels().length).toBeLessThanOrEqual(1));

    await user.keyboard("{Tab}");
    await waitFor(() => expect(focusedPanels().length).toBeLessThanOrEqual(1));
  });

  it("does not swallow Tab while focus is outside the history zones", async () => {
    renderHistoryPage(
      <>
        <a href="#main">Skip to content</a>
        <HistoryPage />
      </>,
    );

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toBeInTheDocument());

    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    skipLink.focus();
    expect(skipLink).toHaveFocus();

    // fireEvent retained: low-level Tab dispatch asserts the global key handler's preventDefault contract.
    const prevented = !fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(prevented).toBe(false);

    runsList.focus();
    // fireEvent retained: low-level Tab dispatch asserts the scoped cycle prevents native tabbing inside a focus zone.
    const preventedInside = !fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(preventedInside).toBe(true);
  });

  it("does not include runs or insights in the Tab cycle when there are no runs", async () => {
    mockUseReviews.mockReturnValue({
      data: { reviews: [] },
      error: null,
      isLoading: false,
    });

    const user = userEvent.setup();
    renderHistoryPage();

    const search = await screen.findByPlaceholderText(/search runs by id/i);
    search.focus();
    await waitFor(() => expect(search).toHaveFocus());

    await user.keyboard("{Tab}");
    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{Tab}");
    await waitFor(() => expect(search).toHaveFocus());
  });

  it("moves the insights highlight with j alias and routes Enter to the issue handler", async () => {
    mockUseReview.mockReturnValue({
      data: {
        review: {
          result: {
            issues: [
              {
                id: "issue-a",
                severity: "high",
                category: "correctness",
                title: "Alpha",
                file: "a.ts",
                line_start: 1,
                line_end: 1,
                rationale: "",
                recommendation: "",
                suggested_patch: null,
                confidence: 0.9,
                symptom: "",
                whyItMatters: "",
                evidence: [],
                enrichment: undefined,
              },
              {
                id: "issue-b",
                severity: "high",
                category: "correctness",
                title: "Beta",
                file: "b.ts",
                line_start: 2,
                line_end: 2,
                rationale: "",
                recommendation: "",
                suggested_patch: null,
                confidence: 0.9,
                symptom: "",
                whyItMatters: "",
                evidence: [],
                enrichment: undefined,
              },
            ],
          },
        },
      },
      error: null,
      isLoading: false,
    });

    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());

    const insightsList = await screen.findByRole("listbox", { name: /run issues/i });

    insightsList.focus();
    await waitFor(() => expect(insightsList).toHaveFocus());

    const alpha = screen.getByRole("option", { name: /alpha/i });
    const beta = screen.getByRole("option", { name: /beta/i });

    expect(insightsList).toHaveAttribute("aria-activedescendant", alpha.id);

    await user.keyboard("j");
    await waitFor(() => expect(insightsList).toHaveAttribute("aria-activedescendant", beta.id));

    mockNavigate.mockClear();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenLastCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "11111111-1111-4111-8111-111111111111" },
      search: { issueId: "issue-b" },
    });
  });

  it("does not programmatically focus the insights pane when no run is selected", async () => {
    mockUseReviews.mockReturnValue({
      data: { reviews: [] },
      error: null,
      isLoading: false,
    });

    renderHistoryPage();

    await screen.findByPlaceholderText(/search runs by id/i);

    const insightsPane = screen.getByRole("complementary", { name: "Review insights" });
    expect(document.activeElement).not.toBe(insightsPane);
  });
});
