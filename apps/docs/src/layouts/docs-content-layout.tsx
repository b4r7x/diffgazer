import { useLocation, useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PageTree } from "./sidebar";
import { DocsSidebar } from "./sidebar";
import { getDocsLibrary, inferDocsLibraryFromPath } from "@/lib/docs-library";

interface DocsContentLayoutProps {
	tree: PageTree;
	children: ReactNode;
}

export function DocsContentLayout({ tree, children }: DocsContentLayoutProps) {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const mainRef = useRef<HTMLElement>(null);
	const router = useRouter();
	const pathname = useLocation({ select: (location) => location.pathname });
	const library = getDocsLibrary(inferDocsLibraryFromPath(pathname));

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
				className={cn(
					"fixed inset-y-0 left-0 z-50 w-[280px] shrink-0 border-r border-border flex flex-col bg-background transition-transform duration-150 ease-in-out",
					"lg:relative lg:translate-x-0 lg:inset-auto",
					sidebarOpen ? "translate-x-0" : "-translate-x-full",
				)}
				data-pagefind-ignore
			>
				<DocsSidebar tree={tree} onNavigate={() => setSidebarOpen(false)} />
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
						{library.sidebarRoot}
					</span>
				</div>

				<main
					ref={mainRef}
					id="main-content"
					tabIndex={-1}
					className="flex-1 min-w-0 min-h-0 overflow-y-auto scrollbar-thin outline-none"
				>
					<div className="max-w-5xl mx-auto px-12 py-10 h-full flex flex-col">
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}
