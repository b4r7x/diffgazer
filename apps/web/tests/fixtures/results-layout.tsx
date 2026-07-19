import { createQueryClientBase } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
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

function ShellFixture() {
  return (
    <AppFixtureProviders>
      <GlobalLayout>
        <div>Shell content</div>
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
