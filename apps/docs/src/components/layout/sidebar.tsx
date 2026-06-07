import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import {
	Sidebar,
	SidebarContent,
	SidebarItem,
	SidebarSection,
	SidebarSectionTitle,
} from "@diffgazer/ui/components/sidebar";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import { type MouseEvent, useEffect, useRef } from "react";
import {
	DOCS_LIBRARY_IDS,
	type DocsLibraryId,
	routeSplatFromDocsPath,
} from "@/lib/library";
import type { PageTree, PageTreeNode } from "@/lib/page-tree";
import { usePendingDocsRoute } from "@/lib/use-pending-docs-route";

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
	return `/${title.toLowerCase().replace(/\s+/g, "_")}`;
}

function getSlug(path: string): string {
	return path.split("/").pop() ?? "";
}

function normalizeLabel(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The section's index page is the item whose url is the parent path of the
 * other items in the same section (a sibling url starts with `indexUrl/`).
 */
export function findSectionIndexUrl(items: PageTreeNode[]): string | null {
	for (const candidate of items) {
		if (!candidate.url) continue;
		const prefix = `${candidate.url}/`;
		if (items.some((other) => other.url?.startsWith(prefix))) {
			return candidate.url;
		}
	}
	return null;
}

/**
 * A section's index item often carries the same title as the section header
 * (e.g. "Hooks" under the "Hooks" section), so it reads as a duplicate of the
 * label directly above it. Relabel that one item to "Overview" so the section
 * header is followed by distinct destinations, matching the terminal docs nav.
 * Items whose title already differs from the section (Introduction, dgadd CLI)
 * keep their own label.
 */
export function sidebarItemLabel(
	sectionTitle: string,
	indexUrl: string | null,
	item: PageTreeNode,
): string {
	const ownLabel = item.name.trim() || getSlug(item.url ?? "");
	if (!indexUrl || item.url !== indexUrl) return ownLabel;
	const normalizedItem = normalizeLabel(ownLabel);
	const normalizedSection = normalizeLabel(sectionTitle);
	const echoesSection =
		normalizedItem === normalizedSection ||
		normalizedItem.startsWith(`${normalizedSection} `) ||
		normalizedItem.startsWith(`${normalizedSection}(`);
	return echoesSection ? "Overview" : ownLabel;
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
	if (items.length === 0) return;
	sections.push({ key: sectionKey(title, items), title, items });
}

export function groupBySection(children: PageTreeNode[]): Section[] {
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
	if (current) pushSection(sections, current.title, current.items);

	return sections;
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
		<Sidebar variant="terminal" className="w-full">
			<SidebarContent className="p-0 overflow-hidden">
				<ScrollArea className="h-full">
					<div className="px-3 pt-2 pb-4" ref={navContainerRef}>
						{sections.map((section) => {
							const indexUrl = findSectionIndexUrl(section.items);
							return (
								<SidebarSection key={section.key}>
									{section.title && (
										<SidebarSectionTitle>
											{formatSectionLabel(section.title)}
										</SidebarSectionTitle>
									)}

									{section.items.map((item) => {
										const url = item.url ?? "";
										const label = sidebarItemLabel(
											section.title,
											indexUrl,
											item,
										);
										const indented = isIndentedItem(url);

										const isPending = pendingPathname === url;
										const isCurrentUrl = pathname === url;
										const itemContent = isPending ? (
											<Spinner size="sm" className="ml-2" />
										) : (
											<span
												className={cn(
													"text-xs font-mono",
													indented && "pl-3 text-muted-foreground",
												)}
											>
												{indented ? `· ${label}` : label}
											</span>
										);

										return (
											<SidebarItem
												key={url}
												active={pathname === url || isPending}
												onClick={(event) => {
													if (!isPrimaryNavigationClick(event)) return;
													onNavigate?.();
												}}
											>
												{({ ref: _ref, ...itemProps }) =>
													isCurrentUrl ? (
														<a
															href={url}
															{...itemProps}
															data-value={url}
															onClick={(event) => {
																itemProps.onClick?.(event);
																if (isPrimaryNavigationClick(event))
																	event.preventDefault();
															}}
														>
															{itemContent}
														</a>
													) : (
														<Link
															to="/$lib/$"
															params={{
																lib: library,
																_splat: routeSplatFromDocsPath(url),
															}}
															{...itemProps}
															data-value={url}
														>
															{itemContent}
														</Link>
													)
												}
											</SidebarItem>
										);
									})}
								</SidebarSection>
							);
						})}
					</div>
				</ScrollArea>
			</SidebarContent>
		</Sidebar>
	);
}
