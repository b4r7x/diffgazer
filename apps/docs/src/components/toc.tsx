import type { TableOfContents } from "fumadocs-core/toc";
import { type MouseEvent, useEffect, useMemo, useRef } from "react";
import {
	type ActiveHeadingActivationMode,
	useActiveHeading,
} from "@/hooks/use-active-heading";
import { ScrollArea } from "@/components/ui/scroll-area/scroll-area";
import { Toc, TocItem, TocList } from "@/components/ui/toc";

function parseHeadingId(url: string): string | null {
	const hashIndex = url.indexOf("#");
	const rawHash = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
	if (!rawHash) return null;

	try {
		return decodeURIComponent(rawHash);
	} catch {
		return rawHash;
	}
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
	return (
		event.button === 0 &&
		!event.metaKey &&
		!event.ctrlKey &&
		!event.shiftKey &&
		!event.altKey
	);
}

interface TableOfContentsPanelProps {
	toc: TableOfContents;
	activationMode?: ActiveHeadingActivationMode;
	/**
	 * Continuous activation position (0–1) within the viewport.
	 * Overrides `activationMode` when set.
	 */
	activationPosition?: number;
	topOffset?: number;
	scrollOffset?: number;
	bottomLock?: boolean;
}

export function TableOfContentsPanel({
	toc,
	activationMode = "top-line",
	activationPosition,
	topOffset = 96,
	scrollOffset = topOffset,
	bottomLock = true,
}: TableOfContentsPanelProps) {
	const itemRefs = useRef(new Map<string, HTMLAnchorElement>());

	const tocEntries = useMemo(
		() =>
			toc.flatMap((item) => {
				const id = parseHeadingId(item.url);
				if (!id) return [];
				return [{ depth: item.depth, title: item.title, id, key: item.url }];
			}),
		[toc],
	);

	const headingIds = useMemo(
		() => tocEntries.map((e) => e.id),
		[tocEntries],
	);

	const { activeId, scrollTo } = useActiveHeading({
		ids: headingIds,
		containerId: "main-content",
		activationMode,
		activationPosition,
		topOffset,
		scrollOffset,
		bottomLock,
	});

	// Keep active TOC item visible in the sidebar scroll area.
	// Don't use scrollIntoView — it scrolls ALL scrollable ancestors,
	// which would unintentionally move the main content area.
	useEffect(() => {
		if (!activeId) return;
		const el = itemRefs.current.get(activeId);
		if (!el) return;

		// Walk up to find the TOC's own scrollable container, stopping
		// before main-content to avoid moving the page.
		let scrollParent: HTMLElement | null = el.parentElement;
		while (scrollParent) {
			if (scrollParent.id === "main-content") return;
			const style = getComputedStyle(scrollParent);
			if (
				(style.overflowY === "auto" || style.overflowY === "scroll") &&
				scrollParent.scrollHeight > scrollParent.clientHeight
			) {
				break;
			}
			scrollParent = scrollParent.parentElement;
		}

		if (!scrollParent) return;

		const parentRect = scrollParent.getBoundingClientRect();
		const elRect = el.getBoundingClientRect();
		if (elRect.top < parentRect.top) {
			scrollParent.scrollBy({
				top: elRect.top - parentRect.top - 8,
				behavior: "smooth",
			});
		} else if (elRect.bottom > parentRect.bottom) {
			scrollParent.scrollBy({
				top: elRect.bottom - parentRect.bottom + 8,
				behavior: "smooth",
			});
		}
	}, [activeId]);

	const onItemClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
		if (!isPlainLeftClick(event)) return;
		event.preventDefault();

		scrollTo(id);

		const nextHash = `#${encodeURIComponent(id)}`;
		if (window.location.hash !== nextHash) {
			window.history.replaceState(window.history.state, "", nextHash);
		}
	};

	if (tocEntries.length === 0) return null;

	return (
		<Toc className="hidden xl:block">
			<div className="sticky top-16 max-h-[calc(100vh-6rem)]">
				<ScrollArea className="h-[calc(100vh-8rem)] pr-2">
					<TocList>
						{tocEntries.map((entry) => {
							const isActive = activeId === entry.id;

							return (
								<TocItem
									key={entry.key}
									ref={(element) => {
										if (element) {
											itemRefs.current.set(entry.id, element);
										} else {
											itemRefs.current.delete(entry.id);
										}
									}}
									href={`#${encodeURIComponent(entry.id)}`}
									depth={entry.depth}
									active={isActive}
									aria-current={isActive ? "location" : undefined}
									onClick={(event) => onItemClick(event, entry.id)}
								>
									{entry.title}
								</TocItem>
							);
						})}
					</TocList>
				</ScrollArea>
			</div>
		</Toc>
	);
}
