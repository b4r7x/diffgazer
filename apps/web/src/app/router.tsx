import { createRoute, createRootRoute, createRouter, redirect } from "@tanstack/react-router";
import { z } from "zod";
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

const reviewSearchSchema = z.object({
  mode: z.enum(["unstaged", "staged", "files"]).optional().default("unstaged"),
});

export type ReviewSearch = z.infer<typeof reviewSearchSchema>;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rootRoute = createRootRoute({
  component: RootLayout,
});

const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: HomePage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/review",
    component: ReviewPage,
    validateSearch: reviewSearchSchema,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/review/$reviewId",
    component: ReviewPage,
    validateSearch: reviewSearchSchema,
    beforeLoad: ({ params }) => {
      if (!UUID_REGEX.test(params.reviewId)) {
        throw redirect({ to: "/", search: { error: "invalid-review-id" } });
      }
    },
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: SettingsHubPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/history",
    component: HistoryPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings/trust-permissions",
    component: TrustPermissionsPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings/theme",
    component: SettingsThemePage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings/providers",
    component: ProviderSettingsPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings/storage",
    component: SettingsStoragePage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings/analysis",
    component: SettingsAnalysisPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings/diagnostics",
    component: SettingsDiagnosticsPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/help",
    component: HelpPage,
  }),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
