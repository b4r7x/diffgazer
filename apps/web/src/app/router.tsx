import { createRoute, createRootRoute, createRouter, redirect, Outlet } from "@tanstack/react-router";
import { z } from "zod";
import { ReviewModeSchema } from "@stargazer/schemas/review";
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
import { HelpPage } from "./routes/help";

const HomeSearchSchema = z.object({
  error: z.string().optional(),
});

export type HomeSearch = z.infer<typeof HomeSearchSchema>;

const ReviewSearchSchema = z.object({
  mode: ReviewModeSchema.optional().default("unstaged"),
});

export type ReviewSearch = z.infer<typeof ReviewSearchSchema>;

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
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review",
  component: ReviewPage,
  validateSearch: ReviewSearchSchema,
});

const reviewWithIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review/$reviewId",
  component: ReviewPage,
  validateSearch: ReviewSearchSchema,
  beforeLoad: ({ params }) => {
    if (!UUID_REGEX.test(params.reviewId)) {
      throw redirect({ to: "/", search: { error: "invalid-review-id" } });
    }
  },
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
});

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/help",
  component: HelpPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsLayout,
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
  reviewRoute,
  reviewWithIdRoute,
  historyRoute,
  helpRoute,
  settingsRoute.addChildren([
    settingsIndexRoute,
    settingsThemeRoute,
    settingsProvidersRoute,
    settingsStorageRoute,
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
