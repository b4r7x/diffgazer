import {
  createRoute,
  createRootRoute,
  createRouter,
  redirect,
  Outlet,
} from "@tanstack/react-router";
import { z } from "zod";
import { ReviewModeSchema } from "@diffgazer/schemas/review";
import { RootLayout } from "./routes/__root";
import { HomePage } from "./routes/home";
import { ReviewPage } from "./routes/review";
import { SettingsHubPage } from "./routes/settings";
import { SettingsAnalysisPage } from "./routes/settings/analysis";
import { SettingsDiagnosticsPage } from "./routes/settings/diagnostics";
import { HistoryPage } from "./routes/history";
import { SettingsStoragePage } from "./routes/settings/storage";
import { SettingsThemePage } from "./routes/settings/theme";
import { TrustPermissionsPage } from "./routes/settings/trust-permissions";
import { ProviderSettingsPage } from "./routes/settings/providers";
import { SettingsAgentExecutionPage } from "./routes/settings/agent-execution";
import { HelpPage } from "./routes/help";
import { OnboardingPage } from "./routes/onboarding";
import {
  requireConfigured,
  requireNotConfigured,
} from "../lib/config-guards/config-guards";

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
  path: "/review",
  component: ReviewPage,
  validateSearch: ReviewSearchSchema,
  beforeLoad: requireConfigured,
});

const reviewWithIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review/$reviewId",
  component: ReviewPage,
  validateSearch: ReviewSearchSchema,
  beforeLoad: async ({ params }) => {
    await requireConfigured();
    if (!UUID_REGEX.test(params.reviewId)) {
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
  reviewWithIdRoute,
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
