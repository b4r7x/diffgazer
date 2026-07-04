import { ReviewModeSchema } from "@diffgazer/core/schemas/review";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { lazy } from "react";
import { z } from "zod";
import { RouteLoadingFallback } from "@/components/layout/route-loading-fallback";
import { requireConfigured, requireNotConfigured } from "../lib/config-guards";
import { RootLayout } from "./routes/__root";
import { HomePage } from "./routes/home";
import { ReviewPage } from "./routes/review";

const SettingsHubPage = lazy(() =>
  import("./routes/settings").then((m) => ({ default: m.SettingsHubPage })),
);
const SettingsAnalysisPage = lazy(() =>
  import("./routes/settings/analysis").then((m) => ({
    default: m.SettingsAnalysisPage,
  })),
);
const SettingsDiagnosticsPage = lazy(() =>
  import("./routes/settings/diagnostics").then((m) => ({
    default: m.SettingsDiagnosticsPage,
  })),
);
const HistoryPage = lazy(() =>
  import("./routes/history").then((m) => ({ default: m.HistoryPage })),
);
const SettingsStoragePage = lazy(() =>
  import("./routes/settings/storage").then((m) => ({
    default: m.SettingsStoragePage,
  })),
);
const SettingsThemePage = lazy(() =>
  import("./routes/settings/theme").then((m) => ({
    default: m.SettingsThemePage,
  })),
);
const SettingsTrustPermissionsPage = lazy(() =>
  import("./routes/settings/trust-permissions").then((m) => ({
    default: m.SettingsTrustPermissionsPage,
  })),
);
const SettingsProvidersPage = lazy(() =>
  import("./routes/settings/providers").then((m) => ({
    default: m.SettingsProvidersPage,
  })),
);
const SettingsAgentExecutionPage = lazy(() =>
  import("./routes/settings/agent-execution").then((m) => ({
    default: m.SettingsAgentExecutionPage,
  })),
);
const HelpPage = lazy(() => import("./routes/help").then((m) => ({ default: m.HelpPage })));
const OnboardingPage = lazy(() =>
  import("./routes/onboarding").then((m) => ({ default: m.OnboardingPage })),
);

const HomeSearchSchema = z.object({
  error: z.string().optional(),
});

const ReviewSearchSchema = z.object({
  mode: ReviewModeSchema.optional().default("unstaged"),
  live: z.boolean().optional(),
  issueId: z.string().optional(),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function SettingsLayout() {
  return <Outlet />;
}

const rootRoute = createRootRoute({
  component: RootLayout,
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
    if (!UUID_REGEX.test(params.reviewId)) {
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
  component: SettingsLayout,
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
  defaultPendingComponent: RouteLoadingFallback,
  defaultPendingMs: 100,
  defaultPendingMinMs: 300,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
