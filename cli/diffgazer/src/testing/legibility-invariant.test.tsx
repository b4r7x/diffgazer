import { canonicalReviewFixture } from "@diffgazer/core/testing/review-facts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { HistoryScreen } from "../features/history/components/screen";
import { HomeScreen } from "../features/home/components/screen";
import { ProvidersScreen } from "../features/providers/components/screen";
import { ReviewResultsView } from "../features/review/components/results-view";
import { cleanupRootFrames, renderRootFrame } from "./render-root-frame";

const f = canonicalReviewFixture;

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useInit: () => ({
    data: {
      configPath: "/tmp/diffgazer/config.json",
      config: { provider: "gemini", model: "gemini-2.5-pro" },
      providers: [],
      settings: {
        theme: "dark",
        defaultLenses: [],
        defaultProfile: null,
        severityThreshold: "low",
        secretsStorage: "file",
        agentExecution: "sequential",
      },
      configured: true,
      project: {
        projectId: "project-1",
        path: "/Users/dev/Projects/diffgazer-workspace",
        trust: {
          repoRoot: "/Users/dev/Projects/diffgazer-workspace",
          capabilities: { readFiles: true, runCommands: false },
        },
      },
      setup: {
        hasSecretsStorage: true,
        hasProvider: true,
        hasModel: true,
        hasTrust: true,
        isConfigured: true,
        isReady: true,
        missing: [],
      },
    },
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useReviews: () => ({
    data: {
      reviews: [
        {
          id: "c0ffee00-1234-4567-89ab-cdef01234567",
          projectPath: "/Users/dev/Projects/diffgazer-workspace",
          createdAt: "2026-07-18T10:33:48.000Z",
          mode: "unstaged",
          branch: "feature/mobile-tui-parity",
          issueCount: 8,
          blockerCount: 1,
          highCount: 2,
          fileCount: 23,
          durationMs: 42780,
        },
      ],
    },
  }),
  useActiveReviewSession: () => ({ data: { session: null } }),
  useShutdown: () => ({ mutate: vi.fn() }),
  useSaveTrust: () => ({ isPending: false, error: null, mutate: vi.fn() }),
  useProviderStatus: () => ({
    data: [{ provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-pro" }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useActivateProvider: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useDeleteProviderCredentials: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock("@diffgazer/core/review", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/review")>()),
  useHistoryScreenState: () => ({
    reviewsQuery: { data: { reviews: [f.metadata], warnings: [] }, isLoading: false, error: null },
    reviewDetailQuery: { isLoading: false, isError: false, error: null, refetch: vi.fn() },
    reviews: [f.metadata],
    timelineItems: [
      { id: "all", label: "All", count: 2 },
      { id: "2026-07-18", label: "Jul 18", count: 1 },
    ],
    selectedDateId: "all",
    setSelectedDateId: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    mappedRuns: [
      {
        id: f.metadata.id,
        displayId: "#c0ffee",
        branch: "feature/mobile-tui-parity",
        timestamp: "Jul 18, 10:33",
        summary: "8 issues · 1 blocker",
      },
    ],
    selectedRunId: f.metadata.id,
    setSelectedRunId: vi.fn(),
    selectedRun: f.metadata,
    severityCounts: { blocker: 1, high: 2, medium: 2, low: 2, nit: 1 },
    sortedIssues: f.result.issues,
    duration: "42.7s",
    hasReviews: true,
    emptyRunsMessage: "No runs yet",
    hasMoreReviews: false,
    isLoadingMoreReviews: false,
    loadMoreReviews: vi.fn(),
  }),
}));

afterEach(() => {
  cleanupRootFrames();
  vi.clearAllMocks();
});

// Below 80 columns every screen stacks its panes and each one gets the whole
// frame width, so the narrow tier is not a like-for-like comparison. The
// invariant this guards is the one the captures exposed: among the tiers that
// split the frame, a WIDER terminal must never elide more than a narrower one.
const SPLIT_WIDTHS = [80, 100, 120] as const;

function withQueryClient(child: ReactElement): ReactElement {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
  return <QueryClientProvider client={client}>{child}</QueryClientProvider>;
}

async function frameAt(columns: number, child: ReactElement, settled: string): Promise<string> {
  const view = renderRootFrame(columns, 30, child);
  await vi.waitFor(() => expect(view.lastFrame()).toContain(settled));
  return stripAnsi(view.lastFrame() ?? "");
}

function countEllipses(frame: string): number {
  return (frame.match(/…/g) ?? []).length;
}

const SCREENS: { name: string; settled: string; render: () => ReactElement }[] = [
  { name: "home", settled: "Main Menu", render: () => <HomeScreen /> },
  {
    name: "providers",
    settled: "Google Gemini",
    render: () => withQueryClient(<ProvidersScreen />),
  },
  { name: "history", settled: "RUNS", render: () => <HistoryScreen /> },
  {
    name: "review results",
    settled: "ISSUES (8)",
    render: () => (
      <ReviewResultsView issues={f.result.issues} reviewId={f.metadata.id} onBack={vi.fn()} />
    ),
  },
];

describe("legibility invariant", () => {
  test.each(SCREENS)("$name never elides more at a wider terminal than at a narrower one", async ({
    settled,
    render,
  }) => {
    const counts: number[] = [];
    for (const columns of SPLIT_WIDTHS) {
      counts.push(countEllipses(await frameAt(columns, render(), settled)));
      cleanupRootFrames();
    }

    expect(counts).toHaveLength(SPLIT_WIDTHS.length);
    for (let index = 1; index < counts.length; index += 1) {
      expect(counts[index]).toBeLessThanOrEqual(counts[index - 1] as number);
    }
  });

  test("prints the home context values whole once the frame is 100 columns", async () => {
    const frame = await frameAt(100, <HomeScreen />, "Main Menu");

    expect(frame).toContain("gemini-2.5-pro");
  });

  test("prints every provider name whole once the frame is 100 columns", async () => {
    const frame = await frameAt(100, withQueryClient(<ProvidersScreen />), "Google Gemini");

    for (const name of ["Google Gemini", "OpenRouter", "Cerebras", "Z.AI Coding Plan"]) {
      expect(frame).toContain(name);
    }
  });

  test("prints full severity chips in the results list at 100 columns", async () => {
    const frame = await frameAt(
      100,
      <ReviewResultsView issues={f.result.issues} reviewId={f.metadata.id} />,
      "ISSUES (8)",
    );

    expect(frame).toContain("[BLOCKER 1]");
    expect(frame).not.toContain("B1 H2");
  });
});
