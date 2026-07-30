import {
  SidebarItem,
  SidebarSection,
  SidebarSectionContent,
  SidebarSectionTitle,
} from "@diffgazer/ui/components/sidebar";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, ScriptOnce, useLocation } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import { isPrimaryNavigationClick } from "@/components/shared/navigation-click";
import { CHROME_SIDEBAR_ITEM_CLASS } from "@/components/shared/sidebar-item";
import { usePendingDocsRoute } from "@/hooks/use-pending-docs-route";
import { DOCS_LIBRARY_IDS, type DocsLibraryId, routeSplatFromDocsPath } from "@/lib/library";
import type { PageTree, PageTreeNode } from "@/lib/page-tree";
import { scrollBehaviorFor } from "@/lib/scroll-behavior";
import {
  consumePrePaintPositioning,
  SIDEBAR_SCROLL_INIT_SCRIPT,
} from "@/lib/sidebar-scroll-bootstrap";
import { TreeSidebarShell } from "./tree-sidebar-shell";

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
  return title.trim() || "Section";
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
function findSectionIndexUrl(items: PageTreeNode[]): string | null {
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
function sidebarItemLabel(
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
  if (DOCS_LIBRARY_IDS.some((id) => slug.startsWith(`${id}-`) && slug !== id)) return true;
  return isCliCommandPath(path);
}

function pushSection(sections: Section[], title: string, items: PageTreeNode[]): void {
  if (items.length === 0) return;
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
      pushSection(sections, node.name, node.children?.filter((c) => c.type === "page") ?? []);
      current = null;
    } else if (node.type === "page") {
      if (!current) current = { title: "", items: [] };
      current.items.push(node);
    }
  }
  if (current) pushSection(sections, current.title, current.items);

  return sections;
}

export function DocsSidebar({ tree, library, onNavigate }: DocsSidebarProps) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const pendingPathname = usePendingDocsRoute();
  const navContainerRef = useRef<HTMLDivElement>(null);
  const lastPositioningRef = useRef<{
    pathname: string;
    options: ScrollIntoViewOptions;
  } | null>(null);

  useLayoutEffect(() => {
    const el = navContainerRef.current?.querySelector<HTMLElement>(`[data-value="${pathname}"]`);
    if (!el) return;

    // `nearest` leaves an item the reader can already see exactly where it is.
    const last = lastPositioningRef.current;
    let options: ScrollIntoViewOptions;
    if (last?.pathname === pathname) {
      options = last.options;
    } else if (last) {
      options = { block: "nearest", behavior: scrollBehaviorFor(el) };
    } else {
      // The first positioning has no previous offset to travel from, and must not
      // redo what the pre-paint script settled — either would show up as a jump.
      options = { block: consumePrePaintPositioning() ? "nearest" : "center", behavior: "instant" };
    }

    el.scrollIntoView(options);
    lastPositioningRef.current = { pathname, options };
  }, [pathname]);

  const sections = groupBySection(tree.children);

  return (
    <TreeSidebarShell innerRef={navContainerRef}>
      {sections.map((section) => {
        const indexUrl = findSectionIndexUrl(section.items);
        const sectionHasActive = section.items.some(
          (item) => item.url && (pathname === item.url || pendingPathname === item.url),
        );
        return (
          <SidebarSection key={section.key} collapsible defaultOpen>
            {section.title ? (
              <SidebarSectionTitle
                className={cn(
                  sectionHasActive ? "text-foreground" : "font-medium text-muted-foreground",
                )}
              >
                {formatSectionLabel(section.title)}
              </SidebarSectionTitle>
            ) : null}

            <SidebarSectionContent>
              {section.items.map((item) => {
                const url = item.url ?? "";
                const label = sidebarItemLabel(section.title, indexUrl, item);
                const indented = isIndentedItem(url);

                const isPending = pendingPathname === url;
                const isCurrentUrl = pathname === url;
                const itemContent = isPending ? (
                  <Spinner size="sm" className="ml-2" />
                ) : (
                  <span className={cn("text-xs font-mono", indented && "text-muted-foreground")}>
                    {label}
                  </span>
                );

                return (
                  <SidebarItem
                    key={url}
                    active={pathname === url || isPending}
                    className={CHROME_SIDEBAR_ITEM_CLASS}
                    onClick={(event) => {
                      if (!isPrimaryNavigationClick(event)) return;
                      onNavigate?.();
                    }}
                  >
                    {({ itemPrefix, ref: _ref, ...itemProps }) =>
                      isCurrentUrl ? (
                        <a
                          href={url}
                          {...itemProps}
                          data-value={url}
                          onClick={(event) => {
                            itemProps.onClick?.(event);
                            if (isPrimaryNavigationClick(event)) event.preventDefault();
                          }}
                        >
                          {itemPrefix}
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
                          {itemPrefix}
                          {itemContent}
                        </Link>
                      )
                    }
                  </SidebarItem>
                );
              })}
            </SidebarSectionContent>
          </SidebarSection>
        );
      })}

      {/* Last inside the scroll area so the parser has laid out every item before the
          script runs. ScriptOnce is SSR-only (renders null on the client) and stamps
          the per-request CSP nonce. */}
      <ScriptOnce>{SIDEBAR_SCROLL_INIT_SCRIPT}</ScriptOnce>
    </TreeSidebarShell>
  );
}
