import { UuidSchema } from "@diffgazer/core/schemas/fields";
import { ReviewModeSchema } from "@diffgazer/core/schemas/review";
import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { z } from "zod";
import { RouteLoadingFallback } from "@/components/layout/route-loading-fallback";
import { requireConfigured, requireNotConfigured } from "../lib/config-guards";
import { NotFoundPage } from "./not-found";
import { RouteRecoveryPage } from "./route-error-boundary";
import { lazyRoute } from "./route-import";
import { RootLayout } from "./routes/__root";
import { HomePage } from "./routes/home";

const SettingsHubPage = lazyRoute(() =>
  import("./routes/settings").then((m) => ({ default: m.SettingsHubPage })),
);
const SettingsAnalysisPage = lazyRoute(() =>
  import("./routes/settings/analysis").then((m) => ({
    default: m.SettingsAnalysisPage,
  })),
);
const SettingsDiagnosticsPage = lazyRoute(() =>
  import("./routes/settings/diagnostics").then((m) => ({
    default: m.SettingsDiagnosticsPage,
  })),
);
const HistoryPage = lazyRoute(() =>
  import("./routes/history").then((m) => ({ default: m.HistoryPage })),
);
const SettingsStoragePage = lazyRoute(() =>
  import("./routes/settings/storage").then((m) => ({
    default: m.SettingsStoragePage,
  })),
);
const SettingsThemePage = lazyRoute(() =>
  import("./routes/settings/theme").then((m) => ({
    default: m.SettingsThemePage,
  })),
);
const SettingsTrustPermissionsPage = lazyRoute(() =>
  import("./routes/settings/trust-permissions").then((m) => ({
    default: m.SettingsTrustPermissionsPage,
  })),
);
const SettingsProvidersPage = lazyRoute(() =>
  import("./routes/settings/providers").then((m) => ({
    default: m.SettingsProvidersPage,
  })),
);
const SettingsAgentExecutionPage = lazyRoute(() =>
  import("./routes/settings/agent-execution").then((m) => ({
    default: m.SettingsAgentExecutionPage,
  })),
);
// ReviewPage is the one route component that reads its typed search/params off
// this router, so the annotation here stops its module type from flowing back
// into the router type — a cycle TypeScript resolves by widening that search to
// `any`. The other lazy routes need no annotation because they read no route
// state from the router they are registered into.
const ReviewPage = lazyRoute(() =>
  import("./routes/review").then((m): { default: ComponentType } => ({ default: m.ReviewPage })),
);
const HelpPage = lazyRoute(() => import("./routes/help").then((m) => ({ default: m.HelpPage })));
const OnboardingPage = lazyRoute(() =>
  import("./routes/onboarding").then((m) => ({ default: m.OnboardingPage })),
);

// Every field parses totally: search values are user-editable text, and a
// malformed one must degrade to the default rather than fail the match into the
// recovery screen, whose only control re-runs matching against the same URL.
const HomeSearchSchema = z.object({
  error: z.string().optional().catch(undefined),
});

const ReviewSearchSchema = z.object({
  mode: ReviewModeSchema.optional().default("unstaged").catch("unstaged"),
  live: z.boolean().optional().catch(undefined),
  issueId: z.string().optional().catch(undefined),
});

// Deep-link target for recovery flows: reconnect gates preselect the affected
// product on the providers screen.
const SettingsProvidersSearchSchema = z.object({
  product: z.string().optional().catch(undefined),
});

const rootRoute = createRootRoute({
  component: RootLayout,
  // This slot replaces RootLayout, so it renders outside the FooterProvider
  // that ConnectedRootLayout mounts; clearing the footer here would throw.
  errorComponent: (props) => <RouteRecoveryPage {...props} clearFooter={false} />,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
  validateSearch: HomeSearchSchema,
  beforeLoad: requireConfigured,
  head: () => ({ meta: [{ title: "Home — Diffgazer" }] }),
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review/{-$reviewId}",
  component: ReviewPage,
  validateSearch: ReviewSearchSchema,
  beforeLoad: async ({ params }) => {
    await requireConfigured();
    if (!params.reviewId) {
      throw redirect({ to: "/" });
    }
    if (!UuidSchema.safeParse(params.reviewId).success) {
      throw redirect({ to: "/", search: { error: "invalid-review-id" } });
    }
  },
  head: () => ({ meta: [{ title: "Review — Diffgazer" }] }),
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
  beforeLoad: requireConfigured,
  head: () => ({ meta: [{ title: "History — Diffgazer" }] }),
});

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/help",
  component: HelpPage,
  beforeLoad: requireConfigured,
  head: () => ({ meta: [{ title: "Help — Diffgazer" }] }),
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  component: OnboardingPage,
  beforeLoad: requireNotConfigured,
  head: () => ({ meta: [{ title: "Setup — Diffgazer" }] }),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  beforeLoad: requireConfigured,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/",
  component: SettingsHubPage,
  head: () => ({ meta: [{ title: "Settings — Diffgazer" }] }),
});

const settingsThemeRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/theme",
  component: SettingsThemePage,
  head: () => ({ meta: [{ title: "Theme — Diffgazer" }] }),
});

const settingsProvidersRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/providers",
  component: SettingsProvidersPage,
  validateSearch: SettingsProvidersSearchSchema,
  head: () => ({ meta: [{ title: "Providers — Diffgazer" }] }),
});

const settingsStorageRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/storage",
  component: SettingsStoragePage,
  head: () => ({ meta: [{ title: "Storage — Diffgazer" }] }),
});

const settingsAgentExecutionRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/agent-execution",
  component: SettingsAgentExecutionPage,
  head: () => ({ meta: [{ title: "Agent Execution — Diffgazer" }] }),
});

const settingsAnalysisRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/analysis",
  component: SettingsAnalysisPage,
  head: () => ({ meta: [{ title: "Analysis — Diffgazer" }] }),
});

const settingsDiagnosticsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/diagnostics",
  component: SettingsDiagnosticsPage,
  head: () => ({ meta: [{ title: "Diagnostics — Diffgazer" }] }),
});

const settingsTrustPermissionsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/trust-permissions",
  component: SettingsTrustPermissionsPage,
  head: () => ({ meta: [{ title: "Trust & Permissions — Diffgazer" }] }),
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  onboardingRoute,
  reviewRoute,
  historyRoute,
  helpRoute,
  settingsRoute.addChildren([
    settingsIndexRoute,
    settingsThemeRoute,
    settingsProvidersRoute,
    settingsStorageRoute,
    settingsAgentExecutionRoute,
    settingsAnalysisRoute,
    settingsDiagnosticsRoute,
    settingsTrustPermissionsRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteRecoveryPage,
  defaultPendingComponent: RouteLoadingFallback,
  defaultNotFoundComponent: NotFoundPage,
  defaultPendingMs: 100,
  defaultPendingMinMs: 300,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
