import { lazy } from "react";
import {
  createRoute,
  createRootRoute,
  createRouter,
  redirect,
  Outlet,
} from "@tanstack/react-router";
import { z } from "zod";
import { ReviewModeSchema } from "@diffgazer/core/schemas/review";
import { RootLayout } from "./routes/__root";
import { HomePage } from "./routes/home";
import { ReviewPage } from "./routes/review";
import {
  requireConfigured,
  requireNotConfigured,
} from "../lib/config-guards/config-guards";

// Lazy-loaded routes (not on critical path)
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
const TrustPermissionsPage = lazy(() =>
  import("./routes/settings/trust-permissions").then((m) => ({
    default: m.TrustPermissionsPage,
  })),
);
const ProviderSettingsPage = lazy(() =>
  import("./routes/settings/providers").then((m) => ({
    default: m.ProviderSettingsPage,
  })),
);
const SettingsAgentExecutionPage = lazy(() =>
  import("./routes/settings/agent-execution").then((m) => ({
    default: m.SettingsAgentExecutionPage,
  })),
);
const HelpPage = lazy(() =>
  import("./routes/help").then((m) => ({ default: m.HelpPage })),
);
const OnboardingPage = lazy(() =>
  import("./routes/onboarding").then((m) => ({ default: m.OnboardingPage })),
);

const HomeSearchSchema = z.object({
  error: z.string().optional(),
});

export type HomeSearch = z.infer<typeof HomeSearchSchema>;

const ReviewSearchSchema = z.object({
  mode: ReviewModeSchema.optional().default("unstaged"),
});

export type ReviewSearch = z.infer<typeof ReviewSearchSchema>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review/{-$reviewId}",
  component: ReviewPage,
  validateSearch: ReviewSearchSchema,
  beforeLoad: async ({ params }) => {
    await requireConfigured();
    if (params.reviewId && !UUID_REGEX.test(params.reviewId)) {
      throw redirect({ to: "/", search: { error: "invalid-review-id" } });
    }
  },
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
  beforeLoad: requireConfigured,
});

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/help",
  component: HelpPage,
  beforeLoad: requireConfigured,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  component: OnboardingPage,
  beforeLoad: requireNotConfigured,
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
});

const settingsThemeRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/theme",
  component: SettingsThemePage,
});

const settingsProvidersRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/providers",
  component: ProviderSettingsPage,
});

const settingsStorageRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/storage",
  component: SettingsStoragePage,
});

const settingsAgentExecutionRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/agent-execution",
  component: SettingsAgentExecutionPage,
});

const settingsAnalysisRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/analysis",
  component: SettingsAnalysisPage,
});

const settingsDiagnosticsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/diagnostics",
  component: SettingsDiagnosticsPage,
});

const settingsTrustPermissionsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/trust-permissions",
  component: TrustPermissionsPage,
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

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
