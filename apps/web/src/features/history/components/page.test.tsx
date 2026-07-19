import type { BoundApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { formatRunId, HISTORY_SEARCH_PLACEHOLDER } from "@diffgazer/core/review";
import type { InitResponse } from "@diffgazer/core/schemas/config";
import type { ReviewIssue, ReviewMetadata, ReviewResponse } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue, makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { Footer } from "@/components/layout/footer";
import { ConfigProvider } from "@/hooks/use-config";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { MAIN_CONTENT_ID } from "@/lib/main-content";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/history-page-test" }),
  useNavigate: () => mockNavigate,
}));

import { HistoryPage } from "./page";
import { TimelineList } from "./timeline-list";

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
    configPath: "/tmp/diffgazer/config.json",
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

function projectWithoutReadAccess(): InitResponse["project"] {
  return {
    projectId: "proj-1",
    path: "/repo",
    trust: {
      projectId: "proj-1",
      repoRoot: "/repo",
      capabilities: { readFiles: false, runCommands: false },
      trustMode: "persistent" as const,
      trustedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function projectWithTrustForPreviousRoot(): InitResponse["project"] {
  return {
    projectId: "proj-1",
    path: "/moved/repo",
    trust: {
      projectId: "proj-1",
      repoRoot: "/old/repo",
      capabilities: { readFiles: true, runCommands: false },
      trustMode: "persistent" as const,
      trustedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function makeReviewResponse(
  id: string,
  issues: ReviewIssue[] = [],
  metadata: ReviewMetadata = makeReviewMetadata({ id }),
): ReviewResponse {
  return {
    review: {
      metadata,
      result: { issues },
      gitContext: { branch: "main", commit: "abc123", fileCount: 1, additions: 0, deletions: 0 },
    },
  };
}

function defaultReviewsResponse() {
  return {
    reviews: [
      makeReviewMetadata({ id: "11111111-1111-4111-8111-111111111111" }),
      makeReviewMetadata({ id: "22222222-2222-4222-8222-222222222222" }),
    ],
  };
}

let mockLoadInit: Mock<BoundApi["loadInit"]>;
let mockGetProviderStatus: Mock<BoundApi["getProviderStatus"]>;
let mockGetReviews: Mock<BoundApi["getReviews"]>;
let mockGetReview: Mock<BoundApi["getReview"]>;

function setupApiMocks(project: InitResponse["project"] = trustedProject()) {
  mockLoadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse(project));
  mockGetProviderStatus = vi
    .fn<BoundApi["getProviderStatus"]>()
    .mockResolvedValue(PROVIDERS_FIXTURE);
  mockGetReviews = vi.fn<BoundApi["getReviews"]>().mockResolvedValue(defaultReviewsResponse());
  mockGetReview = vi
    .fn<BoundApi["getReview"]>()
    .mockImplementation(async (id) => makeReviewResponse(id));
}

function renderHistoryPage(ui: ReactNode = <HistoryPage />) {
  const { Wrapper: ApiWrapper, queryClient } = createTestQueryWrapper({
    ApiProvider,
    api: {
      loadInit: mockLoadInit,
      getProviderStatus: mockGetProviderStatus,
      getReviews: mockGetReviews,
      getReview: mockGetReview,
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

function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

async function focusRunsList() {
  const runsList = await screen.findByRole("listbox", { name: /review runs/i });
  runsList.focus();
  await waitFor(() => expect(runsList).toHaveFocus());
  return runsList;
}

describe("TimelineList pointer selection", () => {
  it("reports a newly clicked date once", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <TimelineList
        items={[
          { id: "all", label: "All", count: 2 },
          { id: "2026-02-09", label: "Feb 9", count: 1 },
        ]}
        selectedId="all"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("option", { name: /Feb 9/i }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("2026-02-09");
  });
});

describe("HistoryPage trust workflow", () => {
  beforeEach(() => {
    setupApiMocks(untrustedProject());
  });

  it("shows the trust workflow on direct /history access before trust is granted", async () => {
    renderHistoryPage();

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("shows history after trust is granted and returns to trust workflow when trust is revoked", async () => {
    mockLoadInit.mockResolvedValue(makeInitResponse(trustedProject()));
    const { queryClient } = renderHistoryPage();
    expect(await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).toBeInTheDocument();

    await act(async () => {
      queryClient.setQueryData(["config", "init"], makeInitResponse(untrustedProject()));
    });

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("does not surface raw TRUST_REQUIRED errors when trust is missing", async () => {
    mockGetReviews.mockRejectedValue(
      Object.assign(new Error("Repository access not granted."), {
        code: "TRUST_REQUIRED",
        status: 403,
      }),
    );

    renderHistoryPage();

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByText(/TRUST_REQUIRED/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/repository access not granted/i)).not.toBeInTheDocument();
  });

  it("shows the trust workflow when stored trust denies repository reads", async () => {
    mockLoadInit.mockResolvedValue(makeInitResponse(projectWithoutReadAccess()));

    renderHistoryPage();

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
    expect(mockGetReviews).not.toHaveBeenCalled();
  });

  it("shows the trust workflow when stored trust belongs to the previous repository root", async () => {
    mockLoadInit.mockResolvedValue(makeInitResponse(projectWithTrustForPreviousRoot()));

    renderHistoryPage();

    expect(await screen.findByText("Trust This Repository?")).toBeInTheDocument();
    expect(screen.getByText("/moved/repo")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
    expect(mockGetReviews).not.toHaveBeenCalled();
  });

  it("keeps trusted history available when only provider status fails", async () => {
    mockLoadInit.mockResolvedValue(makeInitResponse(trustedProject()));
    mockGetProviderStatus.mockRejectedValue(new Error("provider status unavailable"));

    renderHistoryPage();

    expect(await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.queryByText("Trust This Repository?")).not.toBeInTheDocument();
  });
});

describe("HistoryPage loading and error status", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("announces the loading branch as a status region", async () => {
    mockGetReviews.mockReturnValue(new Promise(() => {}));

    renderHistoryPage();

    const loadingRuns = await screen.findByText("Loading runs...");
    expect(loadingRuns).toHaveAttribute("role", "status");
  });

  it("focuses the runs list after deferred reviews replace the loading state", async () => {
    const reviews = createDeferred<ReturnType<typeof defaultReviewsResponse>>();
    mockGetReviews.mockReturnValue(reviews.promise);

    renderHistoryPage();

    expect(await screen.findByText("Loading runs...")).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: /review runs/i })).not.toBeInTheDocument();

    reviews.resolve(defaultReviewsResponse());

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    await waitFor(() => expect(runsList).toHaveFocus());
  });

  it("announces the error branch as an alert region", async () => {
    mockGetReviews.mockRejectedValue(new Error("disk unreadable"));

    renderHistoryPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Error: disk unreadable");
  });

  it("shows an init error instead of routing through untrusted defaults", async () => {
    mockLoadInit.mockRejectedValue(new Error("init unavailable"));

    renderHistoryPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Configuration unavailable.");
    expect(screen.queryByText("Trust This Repository?")).not.toBeInTheDocument();
  });
});

describe("HistoryPage review detail status", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("keeps run metadata visible while the selected review detail is pending", async () => {
    const detail = createDeferred<ReviewResponse>();
    mockGetReview.mockReturnValue(detail.promise);

    renderHistoryPage();

    const loadingDetails = await screen.findByText("Loading review details...");
    expect(
      within(screen.getByRole("complementary", { name: "Review insights" })).getByRole("status"),
    ).toBe(loadingDetails);
    expect(screen.getByText("Severity Breakdown")).toBeInTheDocument();

    detail.resolve(
      makeReviewResponse("11111111-1111-4111-8111-111111111111", [
        makeIssue({ id: "loaded-issue", title: "Loaded issue" }),
      ]),
    );

    expect(await screen.findByRole("option", { name: /loaded issue/i })).toBeInTheDocument();
    expect(screen.queryByText("Loading review details...")).not.toBeInTheDocument();
  });

  it("renders a retryable selected-review error and recovers on retry", async () => {
    mockGetReview
      .mockRejectedValueOnce(new Error("detail disk unreadable"))
      .mockImplementation(async (id) =>
        makeReviewResponse(id, [makeIssue({ id: "retried-issue", title: "Retried issue" })]),
      );

    const user = userEvent.setup();
    renderHistoryPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("detail disk unreadable");
    expect(screen.getByText("Severity Breakdown")).toBeInTheDocument();

    const runsList = screen.getByRole("listbox", { name: /review runs/i });
    runsList.focus();
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("{Tab}");
    const retry = screen.getByRole("button", { name: "Retry" });
    await waitFor(() => expect(document.activeElement).toBe(retry));
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("option", { name: /retried issue/i })).toBeInTheDocument();
    expect(screen.queryByText("detail disk unreadable")).not.toBeInTheDocument();
  });
});

describe("HistoryPage review-list warnings", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("renders a non-blocking notice with the dropped-review count when warnings are present", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: [makeReviewMetadata({ id: "11111111-1111-4111-8111-111111111111" })],
      warnings: [
        {
          kind: "unreadable_review",
          reviewId: "22222222-2222-4222-8222-222222222222",
        },
        {
          kind: "unreadable_review",
          reviewId: "33333333-3333-4333-8333-333333333333",
        },
      ],
    });

    renderHistoryPage();

    expect(await screen.findByText(/2 saved reviews could not be read/i)).toBeInTheDocument();
  });

  it("renders index maintenance separately without inflating the unreadable count", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: defaultReviewsResponse().reviews,
      warnings: [{ kind: "index_build_failed" }, { kind: "index_rewrite_failed" }],
    });

    renderHistoryPage();

    expect(await screen.findByText(/history index could not be rebuilt/i)).toBeInTheDocument();
    expect(screen.getByText(/history index could not be cleaned up/i)).toBeInTheDocument();
    expect(screen.queryByText(/saved reviews? could not be read/i)).not.toBeInTheDocument();
  });

  it("reports salvaged issue loss independently from unreadable saved reviews", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: defaultReviewsResponse().reviews,
      warnings: [
        {
          kind: "invalid_issues_dropped",
          reviewId: "11111111-1111-4111-8111-111111111111",
          count: 2,
        },
      ],
    });

    renderHistoryPage();

    expect(await screen.findByText(/2 invalid saved issues were omitted/i)).toBeInTheDocument();
    expect(screen.queryByText(/saved reviews? could not be read/i)).not.toBeInTheDocument();
  });

  it("renders nothing when the warnings array is empty or absent", async () => {
    mockGetReviews.mockResolvedValue(defaultReviewsResponse());

    renderHistoryPage();

    await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    expect(screen.queryByText(/could not be read/i)).not.toBeInTheDocument();
  });
});

describe("HistoryPage review pagination", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("loads older runs on demand and removes the control after the final page", async () => {
    const olderId = "33333333-3333-4333-8333-333333333333";
    const nextCursor =
      "dg1_WyIyMDI2LTAyLTA4VDA5OjAwOjAwLjAwMFoiLCIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiXQ";
    mockGetReviews.mockImplementation(async (_projectPath, cursor) =>
      cursor
        ? {
            reviews: [makeReviewMetadata({ id: olderId })],
            nextCursor: null,
          }
        : {
            reviews: defaultReviewsResponse().reviews,
            nextCursor,
          },
    );
    const user = userEvent.setup();
    renderHistoryPage();

    const loadMore = await screen.findByRole("button", { name: "Load older runs" });
    expect(screen.queryByText(formatRunId(olderId))).not.toBeInTheDocument();

    const runsList = screen.getByRole("listbox", { name: /review runs/i });
    runsList.focus();
    await waitFor(() => expect(runsList).toHaveFocus());

    await user.keyboard("{Tab}");
    await waitFor(() => expect(document.activeElement).toBe(loadMore));
    await user.keyboard("{Enter}");

    expect(await screen.findByText(formatRunId(olderId))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load older runs" })).not.toBeInTheDocument();
    expect(mockGetReviews).toHaveBeenLastCalledWith(undefined, nextCursor);
  });
});

describe("HistoryPage empty-runs live region", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("keeps the live status region mounted across the runs→empty transition", async () => {
    mockGetReviews.mockResolvedValue(defaultReviewsResponse());
    const { queryClient } = renderHistoryPage();

    await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    const runsPanel = screen.getByRole("region", { name: "Review runs" });
    const liveRegion = within(runsPanel).getByRole("status");
    expect(liveRegion).toHaveTextContent("");

    mockGetReviews.mockResolvedValue({ reviews: [] });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["review"] });
    });

    expect(within(runsPanel).getByRole("status")).toBe(liveRegion);
    await waitFor(() => expect(liveRegion).toHaveTextContent("No runs yet"));
  });
});

describe("HistoryPage keyboard navigation", () => {
  beforeEach(() => {
    clearScopedRouteState("/history-page-test", "date");
    clearScopedRouteState("/history-page-test", "run");
    setupApiMocks(trustedProject());
    mockNavigate.mockReset();
    mockNavigate.mockResolvedValue(undefined);
  });

  it("moves focus from timeline to runs at the boundary and opens the highlighted run", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await focusRunsList();

    await user.click(screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER));
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

    await focusRunsList();

    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await user.click(screen.getByRole("option", { name: "All" }));
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { name: "Feb 9" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the already-selected run with a single pointer tap", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await focusRunsList();
    const [selectedRun] = within(runsList).getAllByRole("option");
    if (selectedRun === undefined) {
      throw new Error("Expected at least one review run option");
    }
    await waitFor(() => expect(selectedRun).toHaveAttribute("aria-selected", "true"));

    mockNavigate.mockClear();
    await user.click(selectedRun);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "11111111-1111-4111-8111-111111111111" },
    });
  });

  it("opens the highlighted run with the open shortcut", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    await focusRunsList();

    await user.keyboard("{ArrowDown}o");

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "22222222-2222-4222-8222-222222222222" },
    });
  });

  it("focuses search with slash without typing slash into the field", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    await focusRunsList();

    await user.keyboard("/");

    const search = screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");
  });

  it("marks the active run with data-highlighted so theming can invert chip colors", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: [
        makeReviewMetadata({
          id: "33333333-3333-4333-8333-333333333333",
          lowCount: 3,
          nitCount: 2,
          issueCount: 5,
        }),
      ],
    });

    renderHistoryPage();

    const runsList = await focusRunsList();

    const options = within(runsList).getAllByRole("option");
    const [activeRun] = options;
    if (activeRun === undefined) {
      throw new Error("Expected at least one review run option");
    }
    await waitFor(() => expect(activeRun).toHaveAttribute("data-highlighted"));

    expect(within(activeRun).getByText(/3 low/i)).toBeInTheDocument();
    expect(within(activeRun).getByText(/2 nit/i)).toBeInTheDocument();
  });

  it("keeps the selected run marked as selected when focus moves to the insights pane", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await focusRunsList();
    const [selectedRun] = within(runsList).getAllByRole("option");
    if (selectedRun === undefined) {
      throw new Error("Expected at least one review run option");
    }
    await waitFor(() => expect(selectedRun).toHaveAttribute("data-highlighted"));

    await user.keyboard("{Tab}");

    await waitFor(() => expect(selectedRun).not.toHaveAttribute("data-highlighted"));
    expect(selectedRun).toHaveAttribute("aria-selected", "true");
    expect(selectedRun).toHaveAttribute("data-selected");
  });

  it("never marks more than one panel as focused as Tab moves the focus zone", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    await focusRunsList();

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

  it("tags each pane frame with its corner label", async () => {
    renderHistoryPage();

    await screen.findByRole("listbox", { name: /review runs/i });

    expect(
      within(screen.getByRole("complementary", { name: "Review sections" })).getByText("Sections"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Review runs" })).getByText("Runs"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("complementary", { name: "Review insights" })).getByText(/^Insights/),
    ).toBeInTheDocument();
  });

  it("keeps native Tab on the skip link outside main while cycling history panes inside main", async () => {
    renderHistoryPage(
      <>
        <a href={`#${MAIN_CONTENT_ID}`}>Skip to content</a>
        <main id={MAIN_CONTENT_ID}>
          <HistoryPage />
        </main>
      </>,
    );

    const runsList = await screen.findByRole("listbox", { name: /review runs/i });
    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    sectionsList.focus();
    await waitFor(() => expect(sectionsList).toHaveFocus());

    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    skipLink.focus();
    expect(skipLink).toHaveFocus();

    // fireEvent retained: low-level Tab dispatch asserts the main boundary declines Tab on the skip link.
    const prevented = !fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(prevented).toBe(false);

    sectionsList.focus();
    // fireEvent retained: low-level Tab dispatch asserts the document-scope cycle claims Tab inside main.
    const preventedInside = !fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(preventedInside).toBe(true);

    await waitFor(() => expect(runsList).toHaveFocus());
  });

  it("keeps native Tab inside the search input", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    const search = await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await user.click(search);
    await waitFor(() => expect(search).toHaveFocus());

    // fireEvent retained: low-level Tab dispatch asserts editable targets keep native Tab (no preventDefault).
    const prevented = !fireEvent.keyDown(search, { key: "Tab", code: "Tab" });
    expect(prevented).toBe(false);
  });

  it("advertises the canonical Switch Pane label in the footer", async () => {
    renderHistoryPage(
      <>
        <HistoryPage />
        <FooterView />
      </>,
    );

    await focusRunsList();

    expect(await screen.findByText("Switch Pane")).toBeInTheDocument();
    expect(screen.queryByText("Switch Focus")).not.toBeInTheDocument();
  });

  it("does not include runs or insights in the Tab cycle when there are no runs", async () => {
    mockGetReviews.mockResolvedValue({ reviews: [] });

    const user = userEvent.setup();
    renderHistoryPage();

    const search = await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    search.focus();
    await waitFor(() => expect(search).toHaveFocus());

    await user.keyboard("{Tab}");
    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{Tab}");
    await waitFor(() => expect(search).toHaveFocus());
  });

  it("skips insights when the selected run has no issues", async () => {
    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await focusRunsList();
    await screen.findByText("Severity Breakdown");
    expect(screen.queryByRole("listbox", { name: /run issues/i })).not.toBeInTheDocument();

    await user.keyboard("{Tab}");

    const search = screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);
    await waitFor(() => expect(document.activeElement).toBe(search));
    expect(document.activeElement).not.toBe(runsList);
  });

  it("adds insights to the focus cycle after deferred details mount its list", async () => {
    const detail = createDeferred<ReviewResponse>();
    mockGetReview.mockReturnValue(detail.promise);
    const user = userEvent.setup();
    renderHistoryPage();

    const runsList = await focusRunsList();
    await screen.findByText("Loading review details...");
    await user.keyboard("{Tab}");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)),
    );

    detail.resolve(
      makeReviewResponse("11111111-1111-4111-8111-111111111111", [
        makeIssue({ id: "deferred-issue", title: "Deferred issue" }),
      ]),
    );
    const insightsList = await screen.findByRole("listbox", { name: /run issues/i });

    runsList.focus();
    await waitFor(() => expect(document.activeElement).toBe(runsList));
    await user.keyboard("{Tab}");

    await waitFor(() => expect(document.activeElement).toBe(insightsList));
  });

  it("moves the insights highlight with j alias and routes Enter to the issue handler", async () => {
    mockGetReview.mockImplementation(async (id) =>
      makeReviewResponse(id, [
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
        },
      ]),
    );

    const user = userEvent.setup();
    renderHistoryPage();

    await focusRunsList();

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
    mockGetReviews.mockResolvedValue({ reviews: [] });

    renderHistoryPage();

    await screen.findByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER);

    const insightsPane = screen.getByRole("complementary", { name: "Review insights" });
    expect(document.activeElement).not.toBe(insightsPane);
  });
});
