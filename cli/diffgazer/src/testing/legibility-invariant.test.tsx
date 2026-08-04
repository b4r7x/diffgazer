import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import {
  makeAllConfigurationsListResponse,
  READY_GEMINI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
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
const shellInit = makeAllConfigurationsListResponse();

vi.mock("../hooks/use-back-handler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/api/hooks")>()),
  useInit: () => ({
    data: {
      schemaVersion: 2 as const,
      configurations: shellInit.configurations,
      selectedConfigurationId: shellInit.selectedConfigurationId,
      settings: {
        theme: "dark",
        defaultLenses: [],
        defaultProfile: null,
        severityThreshold: "low",
        secretsStorage: "file",
        agentExecution: "sequential",
      },
      project: {
        projectId: "project-1",
        path: "/Users/dev/Projects/diffgazer-workspace",
        trust: {
          repoRoot: "/Users/dev/Projects/diffgazer-workspace",
          capabilities: { readFiles: true, runCommands: false },
          projectId: "project-1",
          trustedAt: "2026-01-01T00:00:00.000Z",
          trustMode: "persistent",
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
  useConfigurations: () => ({
    data: shellInit,
    isLoading: false,
    error: null,
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

const SPLIT_WIDTHS = [80, 100, 120] as const;

const MONOTONIC_SCREENS: { name: string; settled: string; render: () => ReactElement }[] = [
  { name: "home", settled: "Main Menu", render: () => <HomeScreen /> },
  {
    name: "providers",
    settled: PRODUCT_REGISTRY.gemini.presentation.name,
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

const PROVIDERS_SCREEN = {
  settled: PRODUCT_REGISTRY.gemini.presentation.name,
  render: () => withQueryClient(<ProvidersScreen />),
};

function makeApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    listConfigurations: vi.fn<BoundApi["listConfigurations"]>().mockResolvedValue(shellInit),
    createConfiguration: vi.fn(),
    updateConfiguration: vi.fn(),
    selectConfiguration: vi.fn(),
    deleteConfiguration: vi.fn(),
    inspectConfiguration: vi.fn(),
    testConfiguration: vi.fn(),
  } satisfies BoundApi;
}

function withQueryClient(child: ReactElement): ReactElement {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider value={makeApi()}>{child}</ApiProvider>
    </QueryClientProvider>
  );
}

async function frameAt(columns: number, child: ReactElement, settled: string): Promise<string> {
  const view = renderRootFrame(columns, 30, child);
  await vi.waitFor(() => expect(view.lastFrame()).toContain(settled));
  return stripAnsi(view.lastFrame() ?? "");
}

function countEllipses(frame: string): number {
  return (frame.match(/…/g) ?? []).length;
}

describe("legibility invariant", () => {
  test.each(
    MONOTONIC_SCREENS,
  )("$name never elides more at a wider terminal than at a narrower one", async ({
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

    expect(frame).toContain(READY_GEMINI_CONFIGURATION.selectedModelId);
  });

  test("prints every provider name whole once the frame is 100 columns", async () => {
    const frame = await frameAt(100, PROVIDERS_SCREEN.render(), PROVIDERS_SCREEN.settled);

    for (const product of Object.values(PRODUCT_REGISTRY)) {
      if (product.kind !== "runnable" || !product.selectable) continue;
      expect(frame).toContain(product.presentation.name);
    }
  });

  test("providers screen exposes V2 product and readiness copy without secret fields", async () => {
    const frame = await frameAt(100, PROVIDERS_SCREEN.render(), PROVIDERS_SCREEN.settled);

    expect(frame).toContain(PRODUCT_REGISTRY.gemini.presentation.name);
    expect(frame).toContain(PRODUCT_REGISTRY.zai.presentation.name);
    expect(frame).toContain("Ready");
    expect(frame).not.toMatch(
      new RegExp(String.raw`\b${LEGACY_V1_HAS_API_KEY_PROPERTY}\b|\bapiKey\b|\bsecret\b`, "i"),
    );
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
