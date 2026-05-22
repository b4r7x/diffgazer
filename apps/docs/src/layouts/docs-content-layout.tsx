import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@diffgazer/ui/lib/utils";
import type { DocsLibraryId } from "@/lib/docs-library";
import { usePendingDocsRoute } from "@/lib/hooks/use-pending-docs-route";
import type { PageTree } from "@/lib/docs-tree";
import { DocsSidebar } from "./sidebar";

interface DocsContentLayoutProps {
	tree: PageTree;
	library: DocsLibraryId;
	children: ReactNode;
}

export function DocsContentLayout({ tree, library, children }: DocsContentLayoutProps) {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const mainRef = useRef<HTMLElement>(null);
	const router = useRouter();
	const pendingDocsPathname = usePendingDocsRoute();
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
					"fixed inset-y-0 left-0 z-50 w-[280px] shrink-0 border-r border-border flex flex-col bg-background transition-transform duration-150 ease-in-out",
					"lg:relative lg:translate-x-0 lg:inset-auto",
					sidebarOpen ? "translate-x-0" : "-translate-x-full",
				)}
				data-pagefind-ignore
			>
				<DocsSidebar tree={tree} library={library} onNavigate={() => setSidebarOpen(false)} />
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
							isDocsRoutePending && "opacity-60",
						)}
					>
						<div className="max-w-7xl mx-auto px-6 py-10 min-h-full flex flex-col">
							{children}
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}
