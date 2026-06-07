import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { Toc, TocItem, TocList } from "@diffgazer/ui/components/toc";
import { type ActiveHeadingActivation, useActiveHeading } from "@diffgazer/ui/hooks/active-heading";
import type { TableOfContents } from "fumadocs-core/toc";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";

interface TocEntry {
  depth: number;
  title: ReactNode;
  id: string;
}

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

// Entries from the compile-time fumadocs TOC (markdown `##`/`###` only). Used
// as the SSR/first-paint seed so hydration matches and markdown pages keep
// their existing TOC without a flash.
function entriesFromToc(toc: TableOfContents): TocEntry[] {
  return toc.flatMap((item) => {
    const id = parseHeadingId(item.url);
    if (!id) return [];
    return [{ depth: item.depth, title: item.title, id }];
  });
}

// Entries from the rendered DOM. This is the complete, document-order set of
// section headings the reader sees, including runtime headings the compile-time
// TOC never sees — `<Step>` titles and feature blocks like the API reference.
// The TOC's own "On this page" heading renders without an id and is skipped.
function entriesFromDom(doc: Document, containerId: string): TocEntry[] {
  const container = doc.getElementById(containerId);
  if (!container) return [];

  const seen = new Set<string>();
  const entries: TocEntry[] = [];

  for (const heading of container.querySelectorAll<HTMLElement>("h2[id], h3[id]")) {
    const { id } = heading;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    entries.push({
      depth: heading.tagName === "H3" ? 3 : 2,
      title: heading.textContent?.trim() ?? "",
      id,
    });
  }

  return entries;
}

// Headings change identity only when their level or id changes, so the (depth,
// id) sequence is enough to detect a real difference and skip redundant updates.
function entriesSignature(entries: TocEntry[]): string {
  return entries.map((e) => `${e.depth}:${e.id}`).join("\n");
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

interface TableOfContentsPanelProps {
  toc: TableOfContents;
  activation?: ActiveHeadingActivation;
  topOffset?: number;
  scrollOffset?: number;
  bottomLock?: boolean;
}

export function TableOfContentsPanel({
  toc,
  activation = "top-line",
  topOffset = 96,
  scrollOffset = topOffset,
  bottomLock = true,
}: TableOfContentsPanelProps) {
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());

  const [tocEntries, setTocEntries] = useState<TocEntry[]>(() => entriesFromToc(toc));

  // Source the rendered entries from the DOM after mount. Headings arrive
  // asynchronously (Suspense-loaded MDX) and include runtime-injected ones
  // (`<Step>` titles, API reference), so the static TOC alone is incomplete.
  // Observe the content container to refresh as headings appear or change.
  useEffect(() => {
    const containerId = "main-content";
    const container = document.getElementById(containerId);
    if (!container) return;

    let current = entriesSignature(entriesFromToc(toc));

    const sync = () => {
      const next = entriesFromDom(document, containerId);
      const signature = entriesSignature(next);
      if (signature === current) return;
      current = signature;
      setTocEntries(next);
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [toc]);

  const headingIds = tocEntries.map((e) => e.id);

  const { activeId, scrollTo } = useActiveHeading({
    ids: headingIds,
    containerId: "main-content",
    activation,
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
                  key={entry.id}
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
