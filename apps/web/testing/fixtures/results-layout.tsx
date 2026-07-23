import { createQueryClientBase } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider, usePageFooter } from "@diffgazer/core/footer";
import type { AgentState } from "@diffgazer/core/schemas/events";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import {
  BACK_SHORTCUT,
  NAVIGATE_SHORTCUT,
  SWITCH_PANE_SHORTCUT,
} from "@diffgazer/core/schemas/presentation";
import { canonicalReviewFixture } from "@diffgazer/core/testing/review-facts";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster, toast } from "@diffgazer/ui/components/toast";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { GlobalLayout } from "@/components/layout/global";
import { ProvidersPage } from "@/features/providers/components/page";
import { ReviewProgressView } from "@/features/review/components/progress-view";
import { ReviewResultsView } from "@/features/review/components/results-view";
import { ReviewSummaryView } from "@/features/review/components/summary-view";
import { ConfigProvider } from "@/hooks/use-config";
import { api } from "@/lib/api";
import { MAIN_CONTENT_ID } from "@/lib/main-content";
import "@/styles/index.css";

const { metadata, result, lensStats, droppedDuplicates } = canonicalReviewFixture;
const queryClient = createQueryClientBase();

function AppFixtureProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <ConfigProvider>
          <KeyboardProvider>
            <FooterProvider>{children}</FooterProvider>
          </KeyboardProvider>
        </ConfigProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function ProvidersFixture() {
  return (
    <AppFixtureProviders>
      <main className="flex h-dvh w-screen overflow-hidden">
        <ProvidersPage />
      </main>
    </AppFixtureProviders>
  );
}

// Mirrors the longest real footer legend (the /history "runs" zone) so the
// shell fixture exercises a legend wider than a narrow fine-pointer viewport.
const LONG_LEGEND_SHORTCUTS: Shortcut[] = [
  SWITCH_PANE_SHORTCUT,
  NAVIGATE_SHORTCUT,
  { key: "Enter/Space", label: "Open Review" },
  { key: "/", label: "Search" },
];
const LONG_LEGEND_RIGHT_SHORTCUTS: Shortcut[] = [BACK_SHORTCUT];

function ShellContent({ longLegend }: { longLegend: boolean }) {
  usePageFooter(
    longLegend
      ? { shortcuts: LONG_LEGEND_SHORTCUTS, rightShortcuts: LONG_LEGEND_RIGHT_SHORTCUTS }
      : { shortcuts: [{ key: "?", label: "Help" }] },
  );
  return <div>Shell content</div>;
}

const PROGRESS_AGENTS: AgentState[] = (
  [
    {
      id: "detective",
      lens: "correctness",
      name: "Detective",
      badgeLabel: "DET",
      badgeVariant: "info",
    },
    {
      id: "guardian",
      lens: "security",
      name: "Guardian",
      badgeLabel: "SEC",
      badgeVariant: "warning",
    },
    {
      id: "optimizer",
      lens: "performance",
      name: "Optimizer",
      badgeLabel: "PERF",
      badgeVariant: "info",
    },
    { id: "tester", lens: "tests", name: "Tester", badgeLabel: "TEST", badgeVariant: "info" },
  ] as const
).map((meta, index) => ({
  id: meta.id,
  meta: { ...meta, description: "" },
  status: "running" as const,
  progress: 25 * index,
  issueCount: index,
}));

function ProgressFixture() {
  return (
    <AppFixtureProviders>
      <main id={MAIN_CONTENT_ID} className="flex h-dvh w-screen flex-col overflow-hidden">
        <ReviewProgressView
          data={{
            steps: [
              { id: "parse", label: "Parse diff", status: "completed" },
              { id: "context", label: "Build context", status: "completed" },
              { id: "review", label: "Run agents", status: "active" },
            ],
            events: [],
            agents: PROGRESS_AGENTS,
            metrics: { filesProcessed: 117, filesTotal: 117, issuesFound: 0 },
            notices: [],
          }}
          isRunning
          onCancel={() => undefined}
          onBack={() => undefined}
        />
      </main>
    </AppFixtureProviders>
  );
}

function ShellFixture() {
  const longLegend = new URLSearchParams(window.location.search).get("legend") === "long";
  return (
    <AppFixtureProviders>
      <GlobalLayout>
        <ShellContent longLegend={longLegend} />
      </GlobalLayout>
    </AppFixtureProviders>
  );
}

function ToastFixture() {
  const position = new URLSearchParams(window.location.search).get("position");
  const toastPosition = position === "top-left" ? "top-left" : "bottom-right";

  return (
    <KeyboardProvider>
      <button type="button" onClick={() => toast("Rendered notification", { duration: Infinity })}>
        Show notification
      </button>
      <Toaster position={toastPosition} />
    </KeyboardProvider>
  );
}

function ResultsFixture() {
  const view = new URLSearchParams(window.location.search).get("view");

  if (view === "providers") return <ProvidersFixture />;
  if (view === "shell") return <ShellFixture />;
  if (view === "progress") return <ProgressFixture />;
  if (view === "toast") return <ToastFixture />;

  const showsSummary = view === "summary";

  return (
    <KeyboardProvider>
      <FooterProvider>
        <main
          id={MAIN_CONTENT_ID}
          className={
            showsSummary ? "h-dvh w-screen overflow-auto" : "flex h-dvh w-screen overflow-hidden"
          }
        >
          {showsSummary ? (
            <ReviewSummaryView
              issues={result.issues}
              reviewId={metadata.id}
              durationMs={metadata.durationMs}
              lensStats={lensStats}
              droppedDuplicates={droppedDuplicates}
              onEnterReview={() => undefined}
              onBack={() => undefined}
            />
          ) : (
            <ReviewResultsView
              issues={result.issues}
              reviewId={metadata.id}
              droppedDuplicates={droppedDuplicates}
            />
          )}
        </main>
      </FooterProvider>
    </KeyboardProvider>
  );
}

const rootRoute = createRootRoute();
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ResultsFixture,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<RouterProvider router={router} />);
