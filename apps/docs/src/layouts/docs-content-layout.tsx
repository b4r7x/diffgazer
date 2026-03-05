import { useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner/spinner";
import { cn } from "@/lib/utils";
import type { DocsLibraryId } from "@/lib/docs-library";
import type { PageTree } from "@/lib/docs-tree";
import { DocsSidebar } from "./sidebar";

interface DocsContentLayoutProps {
	tree: PageTree;
	library: DocsLibraryId;
	children: ReactNode;
}

function isDocsPath(pathname?: string | null): boolean {
	if (!pathname) return false;
	return /^\/[^/]+\/docs(?:\/|$)/.test(pathname);
}

function RegionReloadOverlay({
	label,
	size = "md",
	className,
}: {
	label: string;
	size?: "sm" | "md" | "lg";
	className?: string;
}) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/65",
				className,
			)}
		>
			<div className="rounded-sm border border-border bg-background/90 px-3 py-2 shadow-sm">
				<Spinner size={size}>{label}</Spinner>
			</div>
		</div>
	);
}

export function DocsContentLayout({ tree, library, children }: DocsContentLayoutProps) {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const mainRef = useRef<HTMLElement>(null);
	const router = useRouter();
	const pendingDocsPathname = useRouterState({
		select: (state) => {
			const pendingMatches = state.pendingMatches;
			const pathname = pendingMatches?.[pendingMatches.length - 1]?.pathname;
			return isDocsPath(pathname) ? pathname : null;
		},
	});
	const isDocsRoutePending = pendingDocsPathname !== null;

	useEffect(() => {
		const unsubscribe = router.subscribe("onResolved", () => {
			mainRef.current?.focus();
		});
		return unsubscribe;
	}, [router]);

	return (
		<div className="flex flex-1 min-h-0 overflow-hidden">
			{sidebarOpen && (
				<div
					role="presentation"
					className="fixed inset-0 bg-black/50 z-40 lg:hidden"
					onClick={() => setSidebarOpen(false)}
				/>
			)}

			<aside
				id="sidebar-nav"
				aria-label="Sidebar navigation"
				aria-busy={isDocsRoutePending}
				className={cn(
					"fixed inset-y-0 left-0 z-50 w-[280px] shrink-0 border-r border-border flex flex-col bg-background transition-transform duration-150 ease-in-out relative",
					"lg:relative lg:translate-x-0 lg:inset-auto",
					sidebarOpen ? "translate-x-0" : "-translate-x-full",
				)}
				data-pagefind-ignore
			>
				<DocsSidebar tree={tree} library={library} onNavigate={() => setSidebarOpen(false)} />
				{isDocsRoutePending && (
					<RegionReloadOverlay label="reloading nav..." size="sm" className="z-10" />
				)}
			</aside>

			<div className="flex-1 min-w-0 min-h-0 flex flex-col">
				<div className="sticky top-0 z-30 flex items-center border-b border-border bg-background px-4 py-3 lg:hidden">
					<button
						type="button"
						aria-label="Open navigation menu"
						aria-expanded={sidebarOpen}
						aria-controls="sidebar-nav"
						className="flex flex-col justify-center gap-1 w-6 h-6"
						onClick={() => setSidebarOpen(true)}
					>
						<span className="block h-px w-4 bg-foreground" />
						<span className="block h-px w-4 bg-foreground" />
						<span className="block h-px w-4 bg-foreground" />
					</button>
					<span className="text-muted-foreground text-xs font-mono ml-3">
						{`~/${library}/docs`}
					</span>
				</div>

				<div className="relative flex-1 min-w-0 min-h-0">
					<main
						ref={mainRef}
						id="main-content"
						tabIndex={-1}
						aria-busy={isDocsRoutePending}
						className={cn(
							"h-full min-w-0 min-h-0 overflow-y-auto scrollbar-thin outline-none transition-opacity duration-150",
							isDocsRoutePending && "opacity-80",
						)}
					>
						<div className="max-w-5xl mx-auto px-12 py-10 min-h-full flex flex-col">
							{children}
						</div>
					</main>
					{isDocsRoutePending && (
					<RegionReloadOverlay label="reloading docs..." className="z-10" />
				)}
				</div>
			</div>
		</div>
	);
}
