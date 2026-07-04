import type { BoundApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { InitResponse } from "@diffgazer/core/schemas/config";
import type { ReviewIssue, ReviewMetadata, ReviewResponse } from "@diffgazer/core/schemas/review";
import { makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/history-page-test" }),
  useNavigate: () => mockNavigate,
}));

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

function makeReviewResponse(
  id: string,
  issues: ReviewIssue[] = [],
  metadata: ReviewMetadata = makeReviewMetadata({ id }),
): ReviewResponse {
  return {
    review: {
      metadata,
      result: { summary: "Review summary", issues },
      gitContext: { branch: "main", commit: "abc123", fileCount: 1, additions: 0, deletions: 0 },
      drilldowns: [],
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

async function focusRunsList() {
  const runsList = await screen.findByRole("listbox", { name: /review runs/i });
  runsList.focus();
  await waitFor(() => expect(runsList).toHaveFocus());
  return runsList;
}

describe("HistoryPage trust workflow", () => {
  beforeEach(() => {
    setupApiMocks(untrustedProject());
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
});

describe("HistoryPage loading and error status", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("announces the loading branch as a status region", () => {
    mockGetReviews.mockReturnValue(new Promise(() => {}));

    renderHistoryPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading runs...");
  });

  it("announces the error branch as an alert region", async () => {
    mockGetReviews.mockRejectedValue(new Error("disk unreadable"));

    renderHistoryPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Error: disk unreadable");
  });
});

describe("HistoryPage unreadable-review warnings", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("renders a non-blocking notice with the dropped-review count when warnings are present", async () => {
    mockGetReviews.mockResolvedValue({
      reviews: [makeReviewMetadata({ id: "11111111-1111-4111-8111-111111111111" })],
      warnings: ["reviews/a.json: parse error", "reviews/b.json: parse error"],
    });

    renderHistoryPage();

    expect(await screen.findByText(/2 saved reviews could not be read/i)).toBeInTheDocument();
  });

  it("renders nothing when the warnings array is empty or absent", async () => {
    mockGetReviews.mockResolvedValue(defaultReviewsResponse());

    renderHistoryPage();

    await screen.findByPlaceholderText(/search runs by id/i);
    expect(screen.queryByText(/could not be read/i)).not.toBeInTheDocument();
  });
});

describe("HistoryPage empty-runs live region", () => {
  beforeEach(() => {
    setupApiMocks(trustedProject());
  });

  it("keeps the live status region mounted across the runs→empty transition", async () => {
    mockGetReviews.mockResolvedValue(defaultReviewsResponse());
    const { queryClient } = renderHistoryPage();

    await screen.findByPlaceholderText(/search runs by id/i);
    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent("");

    mockGetReviews.mockResolvedValue({ reviews: [] });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["review"] });
    });

    expect(screen.getByRole("status")).toBe(liveRegion);
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

    await focusRunsList();

    const sectionsList = screen.getByRole("listbox", { name: /review sections/i });
    await user.click(screen.getByRole("option", { name: "All" }));
    await waitFor(() => expect(sectionsList).toHaveFocus());

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { name: "Feb 9" })).toHaveAttribute("aria-selected", "true");
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

    const search = screen.getByPlaceholderText(/search runs by id/i);
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
    mockGetReviews.mockResolvedValue({ reviews: [] });

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

    await screen.findByPlaceholderText(/search runs by id/i);

    const insightsPane = screen.getByRole("complementary", { name: "Review insights" });
    expect(document.activeElement).not.toBe(insightsPane);
  });
});
