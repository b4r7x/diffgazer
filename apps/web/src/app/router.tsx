import { createRouter, createRootRoute, createRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { RootLayout } from './routes/__root'
import {
    HomePage,
    ReviewPage,
    SettingsHubPage,
    HistoryPage,
    TrustPermissionsPage,
    SettingsThemePage,
    ProviderSelectorPage,
    SettingsAboutPage,
} from './pages'

// Search param validation for review routes
const reviewSearchSchema = z.object({
  mode: z.enum(['unstaged', 'staged', 'files']).optional().default('unstaged'),
})

export type ReviewSearch = z.infer<typeof reviewSearchSchema>

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rootRoute = createRootRoute({
    component: RootLayout,
})

const routeTree = rootRoute.addChildren([
    createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: HomePage,
    }),
    createRoute({
        getParentRoute: () => rootRoute,
        path: '/review',
        component: ReviewPage,
        validateSearch: reviewSearchSchema,
    }),
    createRoute({
        getParentRoute: () => rootRoute,
        path: '/review/$reviewId',
        component: ReviewPage,
        validateSearch: reviewSearchSchema,
        beforeLoad: ({ params }) => {
            if (!UUID_REGEX.test(params.reviewId)) {
                throw redirect({ to: '/', search: { error: 'invalid-review-id' } });
            }
        },
    }),
    createRoute({
        getParentRoute: () => rootRoute,
        path: '/settings',
        component: SettingsHubPage,
    }),
    createRoute({
        getParentRoute: () => rootRoute,
        path: '/history',
        component: HistoryPage,
    }),
    createRoute({
        getParentRoute: () => rootRoute,
        path: '/settings/trust',
        component: TrustPermissionsPage,
    }),
    createRoute({
        getParentRoute: () => rootRoute,
        path: '/settings/theme',
        component: SettingsThemePage,
    }),
    createRoute({
        getParentRoute: () => rootRoute,
        path: '/settings/providers',
        component: ProviderSelectorPage,
    }),
    createRoute({
        getParentRoute: () => rootRoute,
        path: '/settings/about',
        component: SettingsAboutPage,
    }),
])

// Create router
export const router = createRouter({ routeTree })

// Register router for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
