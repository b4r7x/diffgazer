import { useLocation, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner/spinner";
import {
  Sidebar,
  SidebarContent,
  SidebarSection,
  SidebarSectionTitle,
  SidebarItem,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area/scroll-area";
import { cn } from "@diffgazer/ui/lib/utils";
import { DOCS_LIBRARY_IDS, type DocsLibraryId } from "@/lib/docs-library";
import { usePendingDocsRoute } from "@/lib/hooks/use-pending-docs-route";
import type { PageTree, PageTreeNode } from "@/lib/docs-tree";

interface DocsSidebarProps {
  tree: PageTree;
  library: DocsLibraryId;
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
  return /^\/[^/]+\/cli\/.+/.test(path) && getSlug(path) !== "cli";
}

function isIndentedItem(path: string): boolean {
  const slug = getSlug(path);
  if (DOCS_LIBRARY_IDS.some((id) => slug.startsWith(`${id}-`) && slug !== id))
    return true;
  return isCliCommandPath(path);
}

function groupBySection(children: PageTreeNode[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const node of children) {
    if (node.type === "separator") {
      if (current) sections.push(current);
      current = { title: node.name, items: [] };
    } else if (node.type === "folder") {
      if (current) sections.push(current);
      sections.push({
        title: node.name,
        items: node.children?.filter((c) => c.type === "page") ?? [],
      });
      current = null;
    } else if (node.type === "page") {
      if (!current) current = { title: "", items: [] };
      current.items.push(node);
    }
  }
  if (current && current.items.length > 0) sections.push(current);

  return sections;
}

function splatFromUrl(url: string): string {
  return url.split("/").slice(2).join("/");
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

                  const isPending = pendingPathname === url;

                  return (
                    <SidebarItem
                      key={url}
                      active={pathname === url || isPending}
                    >
                      {({ ref: _ref, ...itemProps }) => (
                        <Link
                          to="/$lib/$"
                          params={{ lib: library, _splat: splatFromUrl(url) }}
                          onClick={onNavigate}
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
