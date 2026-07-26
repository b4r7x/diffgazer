import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import type { TableOfContents } from "fumadocs-core/toc";
import type { ReactNode } from "react";
import { CHROME_LABEL_CLASS } from "./shared/chrome-label";
import { MobileTocPanel, TableOfContentsPanel, useDocsToc } from "./toc";

export function DocsPageLayout({
  toc,
  header,
  children,
  showToc = true,
}: {
  toc: TableOfContents;
  /** Page title block. Rendered above the mobile TOC so the h1 stays first in reading order. */
  header?: ReactNode;
  children: ReactNode;
  showToc?: boolean;
}) {
  const { entries, activeId, scrollTo } = useDocsToc(toc);

  return (
    <div className="flex flex-1 gap-8">
      <div className="min-w-0 flex-1 px-6 py-8">
        {header}
        {showToc && <MobileTocPanel entries={entries} scrollTo={scrollTo} />}
        {children}
      </div>
      {showToc && (
        <TableOfContentsPanel entries={entries} activeId={activeId} scrollTo={scrollTo} />
      )}
    </div>
  );
}

interface DocsPageHeaderProps {
  title: string;
  description?: string | null;
  tags?: string[];
  lib?: string;
  slug?: string;
  className?: string;
}

export function DocsPageHeader({
  title,
  description,
  tags,
  lib,
  slug,
  className,
}: DocsPageHeaderProps) {
  const hasTags = Boolean(tags && tags.length > 0);
  const hasDescription = Boolean(description && description.length > 0);
  const hasMeta = Boolean(lib && slug);

  return (
    <div className={cn("pb-4", className)}>
      <Typography
        as="h1"
        className="text-2xl font-bold text-foreground mb-2"
        data-pagefind-meta="title"
      >
        {title}
      </Typography>

      {hasMeta && (
        <div className={cn(CHROME_LABEL_CLASS, (hasTags || hasDescription) && "mb-3")}>
          {`${lib}/${slug}`}
        </div>
      )}

      {hasTags && (
        <div className={cn("flex flex-wrap gap-2", hasDescription && "mb-3")}>
          {tags?.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 border border-border font-mono text-2xs uppercase tracking-widest text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {hasDescription && (
        <Typography as="p" className="max-w-3xl break-words">
          {description}
        </Typography>
      )}
    </div>
  );
}

export function DocsPageBody({ children }: { children: ReactNode }) {
  return (
    <Typography variant="prose" className="[&>*:first-child]:mt-0">
      {children}
    </Typography>
  );
}
