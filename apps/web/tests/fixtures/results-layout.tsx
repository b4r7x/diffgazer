import { FooterProvider } from "@diffgazer/core/footer";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider } from "@diffgazer/keys";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { ReviewResultsView } from "@/features/review/components/results-view";
import { MAIN_CONTENT_ID } from "@/lib/main-content";
import "@/styles/index.css";

const issue = makeIssue({
  id: "narrow-layout-issue",
  severity: "high",
  title: "Right pane remains reachable",
  symptom: "The details pane can be inspected at narrow widths.",
  rationale: "The two-pane row owns an explicit horizontal viewport.",
  recommendation: "Keep overflow on the results composition.",
});

function ResultsFixture() {
  return (
    <KeyboardProvider>
      <FooterProvider>
        <main id={MAIN_CONTENT_ID} className="flex h-screen w-screen overflow-hidden">
          <ReviewResultsView issues={[issue]} reviewId="browser-layout" />
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
