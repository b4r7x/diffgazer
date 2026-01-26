import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { RootLayout } from './routes/__root'
import StartReviewPage from './routes/review/index'
import ReviewDetailPage from './routes/review/$reviewId'
import SettingsPage from './routes/settings'
import DashboardPage from './routes/index'
import HistoryPage from './routes/history'
import SessionsPage from './routes/sessions'

// Create root route
const rootRoute = createRootRoute({
    component: RootLayout,
})

// Create children routes
const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: DashboardPage,
})

const reviewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/review',
    component: StartReviewPage,
})

const reviewDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/review/$reviewId',
    component: ReviewDetailPage,
})

const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: SettingsPage,
})

const historyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/history',
    component: HistoryPage,
})

const sessionsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sessions',
    component: SessionsPage,
})

// Create route tree
const routeTree = rootRoute.addChildren([
    indexRoute,
    reviewRoute,
    reviewDetailRoute,
    settingsRoute,
    historyRoute,
    sessionsRoute,
])

// Create router
export const router = createRouter({ routeTree })

// Register router for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}
