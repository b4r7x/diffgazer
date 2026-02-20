import { Link, useLocation } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type FocusEvent,
} from "react";
import { useNavigation } from "keyscope";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarSection,
  SidebarSectionTitle,
  SidebarItem,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area/scroll-area";
import { cn } from "@/lib/utils";
import { inferDocsLibraryFromPath, type DocsLibraryId, getDocsLibrary } from "@/lib/docs-library";

export interface PageTreeNode {
  type: "page" | "separator" | "folder";
  name: string;
  url?: string;
  children?: PageTreeNode[];
}

export interface PageTree {
  name: string;
  children: PageTreeNode[];
}

interface DocsSidebarProps {
  tree: PageTree;
  onNavigate?: () => void;
}

interface Section {
  title: string;
  items: PageTreeNode[];
}

function formatSectionLabel(title: string): string {
  return title.toLowerCase().replace(/\s+/g, "-");
}

function getSlug(path: string): string {
  return path.split("/").pop() ?? "";
}

function isCliCommandPath(path: string): boolean {
  return path.startsWith("/docs/cli/") && getSlug(path) !== "cli";
}

export function isIndentedItem(path: string): boolean {
  const slug = getSlug(path);
  if (slug.startsWith("keyscope-") && slug !== "keyscope") return true;
  return isCliCommandPath(path);
}

function belongsToLibrary(path: string, libraryId: DocsLibraryId): boolean {
  if (libraryId === "keyscope") {
    return path.startsWith("/docs/keyscope");
  }
  return !path.startsWith("/docs/keyscope");
}

export function filterTreeByLibrary(tree: PageTree, libraryId: DocsLibraryId): PageTree {
  const children: PageTreeNode[] = [];

  for (const node of tree.children) {
    if (node.type === "separator") {
      children.push(node);
      continue;
    }

    if (node.type === "page") {
      const url = node.url ?? "";
      if (belongsToLibrary(url, libraryId)) {
        children.push(node);
      }
      continue;
    }

    if (node.type === "folder") {
      const filteredChildren =
        node.children?.filter((child) => {
          if (child.type !== "page") return false;
          const url = child.url ?? "";
          return belongsToLibrary(url, libraryId);
        }) ?? [];

      if (filteredChildren.length > 0) {
        children.push({
          ...node,
          children: filteredChildren,
        });
      }
    }
  }

  return {
    ...tree,
    children,
  };
}

function groupBySection(children: PageTreeNode[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const node of children) {
    if (node.type === "separator") {
      if (current && current.items.length > 0) sections.push(current);
      current = { title: node.name, items: [] };
    } else if (node.type === "folder") {
      if (current && current.items.length > 0) sections.push(current);
      const folderItems = node.children?.filter((c) => c.type === "page") ?? [];
      if (folderItems.length > 0) {
        sections.push({
          title: node.name,
          items: folderItems,
        });
      }
      current = null;
    } else if (node.type === "page") {
      if (!current) current = { title: "", items: [] };
      current.items.push(node);
    }
  }
  if (current && current.items.length > 0) sections.push(current);

  return sections;
}

export function DocsSidebar({ tree, onNavigate }: DocsSidebarProps) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const libraryId = inferDocsLibraryFromPath(pathname);
  const library = getDocsLibrary(libraryId);
  const navContainerRef = useRef<HTMLDivElement>(null);

  const { onKeyDown: keyScopeKeyDown, highlight } = useNavigation({
    containerRef: navContainerRef,
    role: "menuitem",
    wrap: false,
    preventDefault: false,
    onHighlightChange: (url) => {
      const items =
        navContainerRef.current?.querySelectorAll<HTMLElement>(
          "[role='menuitem']",
        );
      const el = Array.from(items ?? []).find(
        (item) => item.dataset.value === url,
      );
      el?.focus();
    },
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
        e.preventDefault();
      }
      keyScopeKeyDown(e);
    },
    [keyScopeKeyDown],
  );

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-value]",
      );
      const url = target?.dataset.value;
      if (url) highlight(url);
    },
    [highlight],
  );

  useEffect(() => {
    const el = navContainerRef.current?.querySelector<HTMLElement>(
      `[data-value="${pathname}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [pathname]);

  const filteredTree = filterTreeByLibrary(tree, libraryId);
  const sections = groupBySection(filteredTree.children);

  return (
    <Sidebar>
      <SidebarHeader>
        <span className="text-muted-foreground text-xs font-mono">{library.sidebarRoot}</span>
      </SidebarHeader>

      <SidebarContent className="p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div
            className="p-4"
            ref={navContainerRef}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
          >
            {sections.map((section, i) => (
              <SidebarSection key={`${i}-${section.title}`}>
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
                  const splat = url.startsWith("/docs/")
                    ? url.slice("/docs/".length)
                    : url;

                  return (
                    <Link
                      key={url}
                      to="/docs/$"
                      params={{ _splat: splat }}
                      onClick={onNavigate}
                      data-value={url}
                      role="menuitem"
                    >
                      <SidebarItem active={pathname === url}>
                        <span
                          className={cn(
                            "text-xs font-mono",
                            indented ? "pl-5 text-muted-foreground" : "pl-2",
                          )}
                        >
                          {indented ? `· ${label}` : label}
                        </span>
                      </SidebarItem>
                    </Link>
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
