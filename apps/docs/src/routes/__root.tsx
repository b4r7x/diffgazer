import {
	HeadContent,
	Outlet,
	Scripts,
	Link,
	createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { TanstackProvider } from "fumadocs-core/framework/tanstack";
import { KeyboardProvider } from "keyscope";

import appCss from "../index.css?url";
import { SearchDialog } from "@/features/search/components/search-dialog";
import { SearchProvider } from "@/features/search/search-context";
import { GlobalNotFound } from "@/components/not-found";
import { NotFoundState } from "@/components/not-found-state";
import { Button } from "@/components/ui/button/button";
import { PRIMARY_DOCS_LIBRARY_ID } from "@/lib/docs-library";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "diffgazer docs",
			},
			{
				name: "description",
				content:
					"Unified documentation and registry host for diffgazer libraries.",
			},
		],
		links: [
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	shellComponent: RootDocument,
	component: RootLayout,
	notFoundComponent: RootNotFound,
	errorComponent: RootErrorBoundary,
});

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" data-theme="dark" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="tui-base min-h-screen">
				{children}
				<Scripts />
			</body>
		</html>
	);
}

function RootLayout() {
	return (
		<TanstackProvider>
			<KeyboardProvider>
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-foreground focus:text-background focus:px-3 focus:py-1 focus:text-xs focus:font-mono"
				>
					Skip to content
				</a>
				<SearchProvider>
					<Outlet />
					<SearchDialog />
				</SearchProvider>
			</KeyboardProvider>
		</TanstackProvider>
	);
}

function RootErrorBoundary({ reset }: { reset: () => void }) {
	return (
		<div className="px-4">
			<NotFoundState
				variant="global"
				statusLabel="ERROR"
				title="Something went wrong"
				description="An unexpected error occurred while rendering this page."
				primaryAction={
					<Button variant="primary" onClick={() => reset()}>
						Try again
					</Button>
				}
				secondaryAction={
					<Link to="/$lib/docs" params={{ lib: PRIMARY_DOCS_LIBRARY_ID }}>
						<Button variant="ghost">Open docs</Button>
					</Link>
				}
			/>
		</div>
	);
}

function RootNotFound() {
	return <GlobalNotFound />;
}
