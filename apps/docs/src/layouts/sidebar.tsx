import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import { type MouseEvent, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area/scroll-area";
import {
	Sidebar,
	SidebarContent,
	SidebarItem,
	SidebarSection,
	SidebarSectionTitle,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner/spinner";
import { DOCS_LIBRARY_IDS, type DocsLibraryId } from "@/lib/docs-library";
import type { PageTree, PageTreeNode } from "@/lib/docs-tree";
import { usePendingDocsRoute } from "@/lib/hooks/use-pending-docs-route";

interface DocsSidebarProps {
	tree: PageTree;
	library: DocsLibraryId;
	onNavigate?: () => void;
}

interface Section {
	key: string;
	title: string;
	items: PageTreeNode[];
}

function sectionKey(title: string, items: PageTreeNode[]): string {
	const firstUrl = items.find((item) => item.url)?.url;
	return `${title}::${firstUrl ?? ""}`;
}

function formatSectionLabel(title: string): string {
	return title.toLowerCase().replace(/\s+/g, "-");
}

function getSlug(path: string): string {
	return path.split("/").pop() ?? "";
}

function isCliCommandPath(path: string): boolean {
	return /^\/[^/]+\/cli\/.+/.test(path) && getSlug(path) !== "cli";
}

function isIndentedItem(path: string): boolean {
	const slug = getSlug(path);
	if (DOCS_LIBRARY_IDS.some((id) => slug.startsWith(`${id}-`) && slug !== id))
		return true;
	return isCliCommandPath(path);
}

function pushSection(
	sections: Section[],
	title: string,
	items: PageTreeNode[],
): void {
	sections.push({ key: sectionKey(title, items), title, items });
}

function groupBySection(children: PageTreeNode[]): Section[] {
	const sections: Section[] = [];
	let current: { title: string; items: PageTreeNode[] } | null = null;

	for (const node of children) {
		if (node.type === "separator") {
			if (current) pushSection(sections, current.title, current.items);
			current = { title: node.name, items: [] };
		} else if (node.type === "folder") {
			if (current) pushSection(sections, current.title, current.items);
			pushSection(
				sections,
				node.name,
				node.children?.filter((c) => c.type === "page") ?? [],
			);
			current = null;
		} else if (node.type === "page") {
			if (!current) current = { title: "", items: [] };
			current.items.push(node);
		}
	}
	if (current && current.items.length > 0)
		pushSection(sections, current.title, current.items);

	return sections;
}

function splatFromUrl(url: string): string {
	return url.split("/").slice(2).join("/");
}

/** A new-tab/background click (middle button or modifier) should not dismiss the sidebar. */
export function isPrimaryNavigationClick(event: MouseEvent): boolean {
	return (
		event.button === 0 &&
		!event.metaKey &&
		!event.ctrlKey &&
		!event.shiftKey &&
		!event.altKey
	);
}

export function DocsSidebar({ tree, library, onNavigate }: DocsSidebarProps) {
	const pathname = useLocation({ select: (l) => l.pathname });
	const pendingPathname = usePendingDocsRoute();
	const navContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = navContainerRef.current?.querySelector<HTMLElement>(
			`[data-value="${pathname}"]`,
		);
		el?.scrollIntoView({ block: "nearest", behavior: "instant" });
	}, [pathname]);

	const sections = groupBySection(tree.children);

	return (
		<Sidebar variant="bar" className="w-full">
			<SidebarContent className="p-0 overflow-hidden">
				<ScrollArea className="h-full">
					<div className="px-3 pt-2 pb-4" ref={navContainerRef}>
						{sections.map((section) => (
							<SidebarSection key={section.key}>
								{section.title && (
									<SidebarSectionTitle>
										{formatSectionLabel(section.title)}/
									</SidebarSectionTitle>
								)}

								{section.items.map((item) => {
									const url = item.url ?? "";
									const slug = getSlug(url);
									const label = item.name.trim() || slug;
									const indented = isIndentedItem(url);

									const isPending = pendingPathname === url;

									return (
										<SidebarItem
											key={url}
											active={pathname === url || isPending}
											onClick={(event) => {
												if (isPrimaryNavigationClick(event)) onNavigate?.();
											}}
										>
											{({ ref: _ref, ...itemProps }) => (
												<Link
													to="/$lib/$"
													params={{ lib: library, _splat: splatFromUrl(url) }}
													data-value={url}
													{...itemProps}
												>
													{isPending ? (
														<Spinner size="sm" className="ml-2" />
													) : (
														<span
															className={cn(
																"text-xs font-mono",
																indented
																	? "pl-5 text-muted-foreground"
																	: "pl-2",
															)}
														>
															{indented ? `· ${label}` : label}
														</span>
													)}
												</Link>
											)}
										</SidebarItem>
									);
								})}
							</SidebarSection>
						))}
					</div>
				</ScrollArea>
			</SidebarContent>
		</Sidebar>
	);
}
