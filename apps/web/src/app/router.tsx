import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
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

// Create root route
const rootRoute = createRootRoute({
    component: RootLayout,
})

// Create children routes
const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomePage,
})

const reviewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/review',
    component: ReviewPage,
})

const reviewDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/review/$reviewId',
    component: ReviewPage,
})

const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: SettingsHubPage,
})

const historyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/history',
    component: HistoryPage,
})

const trustPermissionsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings/trust',
    component: TrustPermissionsPage,
})

const themeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings/theme',
    component: SettingsThemePage,
})

const providerSelectorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings/providers',
    component: ProviderSelectorPage,
})

const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings/about',
    component: SettingsAboutPage,
})

// Create route tree
const routeTree = rootRoute.addChildren([
    indexRoute,
    reviewRoute,
    reviewDetailRoute,
    settingsRoute,
    historyRoute,
    trustPermissionsRoute,
    themeRoute,
    providerSelectorRoute,
    aboutRoute,
])

// Create router
export const router = createRouter({ routeTree })

// Register router for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
