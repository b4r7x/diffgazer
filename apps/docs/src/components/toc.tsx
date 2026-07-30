import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { Toc, TocItem, TocList } from "@diffgazer/ui/components/toc";
import { useActiveHeading } from "@diffgazer/ui/hooks/active-heading";
import { cn } from "@diffgazer/ui/lib/utils";
import type { TableOfContents } from "fumadocs-core/toc";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { scrollBehaviorFor } from "@/lib/scroll-behavior";
import { CHROME_LABEL_CLASS } from "./shared/chrome-label";
import { isPrimaryNavigationClick } from "./shared/navigation-click";

const CONTENT_CONTAINER_ID = "main-content";
const TOC_TITLE = "On this page";

export interface TocEntry {
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
    // Rendered demos ship their own section headings (the useActiveHeading
    // examples do). Those are the demo's content, not the page's, so they must
    // neither list as TOC rows nor drive this page's scroll spy.
    if (heading.closest("[data-demo-preview]")) continue;
    seen.add(id);
    entries.push({
      depth: heading.tagName === "H3" ? 3 : 2,
      title: heading.textContent?.trim() ?? "",
      id,
    });
  }

  return entries;
}

// Headings change identity when their level, id, or title changes, so the
// (depth, id, title) sequence is enough to detect a real difference and skip
// redundant updates.
function entriesSignature(entries: TocEntry[]): string {
  return entries.map((e) => `${e.depth}:${e.id}:${e.title}`).join("\n");
}

function syncLocationHash(id: string): void {
  const nextHash = `#${encodeURIComponent(id)}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(window.history.state, "", nextHash);
  }
}

// Source the rendered entries from the DOM after mount. Headings arrive
// asynchronously (Suspense-loaded MDX) and include runtime-injected ones
// (`<Step>` titles, API reference), so the static TOC alone is incomplete.
// Observe the content container to refresh as headings appear or change.
function useTocEntries(toc: TableOfContents): { entries: TocEntry[]; isReady: boolean } {
  const [tocEntries, setTocEntries] = useState<TocEntry[]>(() => entriesFromToc(toc));
  const [readyToc, setReadyToc] = useState<TableOfContents | null>(null);

  useLayoutEffect(() => {
    const containerId = CONTENT_CONTAINER_ID;
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
    setReadyToc(toc);

    const observer = new MutationObserver(sync);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["id"],
    });
    return () => observer.disconnect();
  }, [toc]);

  return { entries: tocEntries, isReady: readyToc === toc };
}

/**
 * The page's table of contents, resolved once per page. Both the mobile
 * disclosure and the sidebar panel render from this single result, so a page
 * never runs two heading observers or two scroll spies over the same content.
 */
export function useDocsToc(toc: TableOfContents): {
  entries: TocEntry[];
  isReady: boolean;
  activeId: string | null;
  scrollTo: (id: string) => void;
} {
  const { entries, isReady } = useTocEntries(toc);
  const { activeId, scrollTo } = useActiveHeading({
    ids: entries.map((entry) => entry.id),
    containerId: CONTENT_CONTAINER_ID,
  });

  return { entries, isReady, activeId, scrollTo };
}

export interface TocPanelProps {
  entries: TocEntry[];
  scrollTo: (id: string) => void;
}

/**
 * Below xl the sidebar TOC is hidden, leaving long pages with no in-page
 * navigation. A native `<details>` disclosure above the article restores it
 * without duplicating the sidebar's open/close state in React.
 */
export function MobileTocPanel({ entries, scrollTo }: TocPanelProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  if (entries.length === 0) return null;

  const onEntryClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!isPrimaryNavigationClick(event)) return;
    event.preventDefault();

    // The disclosure sits between the reader and the heading they picked;
    // leaving it open would push the target back off screen.
    if (detailsRef.current) detailsRef.current.open = false;

    scrollTo(id);
    syncLocationHash(id);
  };

  return (
    <details ref={detailsRef} className="group mb-6 border border-border xl:hidden">
      <summary
        className={cn(
          CHROME_LABEL_CLASS,
          "flex min-h-9 cursor-pointer select-none list-none items-center gap-2 px-3 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden",
        )}
      >
        <span
          aria-hidden="true"
          className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
        >
          ›
        </span>
        {TOC_TITLE}
      </summary>
      <nav aria-label={TOC_TITLE} className="border-t border-border px-3 py-2">
        <TocList>
          {entries.map((entry) => (
            <TocItem
              key={entry.id}
              href={`#${encodeURIComponent(entry.id)}`}
              depth={entry.depth}
              className="flex min-h-8 items-center pointer-coarse:min-h-11"
              onClick={(event) => onEntryClick(event, entry.id)}
            >
              {entry.title}
            </TocItem>
          ))}
        </TocList>
      </nav>
    </details>
  );
}

export function TableOfContentsPanel({
  entries,
  activeId,
  scrollTo,
}: TocPanelProps & { activeId: string | null }) {
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());

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
      if (scrollParent.id === CONTENT_CONTAINER_ID) return;
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
        behavior: scrollBehaviorFor(el),
      });
    } else if (elRect.bottom > parentRect.bottom) {
      scrollParent.scrollBy({
        top: elRect.bottom - parentRect.bottom + 8,
        behavior: scrollBehaviorFor(el),
      });
    }
  }, [activeId]);

  const onItemClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!isPrimaryNavigationClick(event)) return;
    event.preventDefault();
    scrollTo(id);
    syncLocationHash(id);
  };

  if (entries.length === 0) return null;

  return (
    <Toc className="hidden w-56 shrink-0 py-8 pr-4 xl:block">
      <div className="sticky top-16 max-h-[calc(100dvh-6rem)]">
        <ScrollArea className="h-[calc(100dvh-8rem)] pr-2">
          <TocList>
            {entries.map((entry) => {
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
