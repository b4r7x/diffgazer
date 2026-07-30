import { InlineCode } from "@diffgazer/ui/components/code-block";
import { Skeleton } from "@diffgazer/ui/components/skeleton";
import { Toc } from "@diffgazer/ui/components/toc";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import type { TableOfContents } from "fumadocs-core/toc";
import { Fragment, type ReactNode } from "react";
import { useDocsTree } from "@/hooks/docs-tree-context";
import { ArticleSkeleton } from "./article-skeleton";
import { DocsPathBreadcrumbs } from "./docs-path-breadcrumbs";
import { PreviewModeProvider } from "./preview-mode-context";
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
  const { entries, isReady: isTocReady, activeId, scrollTo } = useDocsToc(toc);
  let mobileToc: ReactNode = null;
  let desktopToc: ReactNode = null;

  if (showToc) {
    mobileToc = isTocReady ? (
      <MobileTocPanel entries={entries} scrollTo={scrollTo} />
    ) : (
      <MobileTocLoadingPanel />
    );
    desktopToc = isTocReady ? (
      <TableOfContentsPanel entries={entries} activeId={activeId} scrollTo={scrollTo} />
    ) : (
      <DocsPageLoadingTocPanel />
    );
  }

  return (
    <PreviewModeProvider>
      <DocsPageFrame
        article={
          <>
            {header}
            {mobileToc}
            {children}
          </>
        }
        toc={desktopToc}
      />
    </PreviewModeProvider>
  );
}

export function DocsPageLoadingFrame() {
  return (
    <DocsPageFrame
      article={
        <section>
          <ArticleSkeleton label="Loading documentation page" eyebrow />
        </section>
      }
      toc={<DocsPageLoadingTocPanel />}
    />
  );
}

function DocsPageFrame({ article, toc }: { article: ReactNode; toc: ReactNode }) {
  return (
    <div className="flex flex-1 gap-8">
      <div className="min-w-0 flex-1 px-6 py-8">{article}</div>
      {toc}
    </div>
  );
}

function DocsPageLoadingTocPanel() {
  return (
    <Toc aria-hidden="true" className="hidden w-56 shrink-0 py-8 pr-4 xl:block">
      {/* Sticky like the real TOC, so a page restored to a deep offset shows the
          skeleton at the viewport rather than at page top. */}
      <div className="sticky top-16 max-h-[calc(100dvh-6rem)]">
        <div className="space-y-3 pr-2">
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </Toc>
  );
}

function MobileTocLoadingPanel() {
  return (
    <div aria-hidden="true" className="mb-6 border border-border px-3 py-3 xl:hidden">
      <Skeleton className="h-3 w-32" />
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
  const hasMeta = Boolean(lib && slug);
  const tree = useDocsTree();

  return (
    <div className={cn("pb-4", className)}>
      {/* Scope line first: the path is the address, the title is the destination.
          Below lg the sidebar (and its own PATH row) is a closed drawer, so this
          row hosts the interactive breadcrumbs the reader would otherwise lose —
          the article body no longer prints a second copy of the same path. */}
      {hasMeta && (
        <div className={cn(CHROME_LABEL_CLASS, "mb-2 flex items-center gap-2")}>
          {tree ? (
            <>
              <DocsPathBreadcrumbs tree={tree} className="min-w-0 flex-1 lg:hidden" />
              <span className="hidden lg:inline">{`${lib}/${slug}`}</span>
            </>
          ) : (
            <span>{`${lib}/${slug}`}</span>
          )}
        </div>
      )}

      <Typography as="h1" className="font-bold text-foreground mb-2" data-pagefind-meta="title">
        {title}
      </Typography>

      {tags && tags.length > 0 ? (
        <div className={cn("flex flex-wrap gap-2", description && "mb-3")}>
          {tags.map((tag) => (
            <span key={tag} className={cn(CHROME_LABEL_CLASS, "px-2 py-1 border border-border")}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {description ? (
        <Typography as="p" className="max-w-3xl break-words">
          {renderInlineCode(description)}
        </Typography>
      ) : null}
    </div>
  );
}

/**
 * Frontmatter descriptions are markdown, and 32 of them open on an inline code
 * span. Typeset those spans with the same chip the body uses instead of shipping
 * the author's backticks as literal punctuation. An unpaired backtick means the
 * text is not code-delimited at all, so it renders verbatim.
 */
function renderInlineCode(text: string): ReactNode {
  const segments = text.split("`");
  if (segments.length < 3 || segments.length % 2 === 0) return text;

  return segments.map((segment, index) =>
    index % 2 === 1 ? (
      // Segment index is the only identity a split string has, and the list is
      // never reordered.
      // biome-ignore lint/suspicious/noArrayIndexKey: positional segments of one string
      <InlineCode key={index}>{segment}</InlineCode>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: positional segments of one string
      <Fragment key={index}>{segment}</Fragment>
    ),
  );
}

export function DocsPageBody({ children }: { children: ReactNode }) {
  return (
    <Typography variant="prose" className="[&>*:first-child]:mt-0">
      {children}
    </Typography>
  );
}
