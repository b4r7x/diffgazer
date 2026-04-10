import type { ReactNode } from "react"
import type { TableOfContents } from "fumadocs-core/toc"
import { TableOfContentsPanel } from "./toc"
import { Typography } from "@/components/ui/typography/typography"
import { cn } from "@diffgazer/core/cn"

export function DocsPageLayout({
  toc,
  children,
  showToc = true,
}: {
  toc: TableOfContents
  children: ReactNode
  showToc?: boolean
}) {
  return (
    <div className="flex flex-1 flex-row gap-8">
      <div className="flex-1 min-w-0 py-8 px-6">{children}</div>
      {showToc && <TableOfContentsPanel toc={toc} />}
    </div>
  )
}

type DocsPageHeaderVariant = "compact" | "prominent"

interface DocsPageHeaderProps {
  title: string
  description?: string | null
  tags?: string[]
  variant?: DocsPageHeaderVariant
  bordered?: boolean
  className?: string
}

export function DocsPageHeader({
  title,
  description,
  tags,
  variant = "compact",
  bordered = false,
  className,
}: DocsPageHeaderProps) {
  const hasTags = Boolean(tags && tags.length > 0)
  const hasDescription = Boolean(description && description.length > 0)

  return (
    <div className={cn("pb-8", bordered && "border-b border-border", className)}>
      <h1
        className={cn(
          "text-foreground font-bold",
          variant === "compact"
            ? "font-mono text-2xl mb-2"
            : "text-3xl tracking-tight mb-4",
        )}
        data-pagefind-meta="title"
      >
        {title}
      </h1>

      {hasTags && (
        <div className={cn("flex flex-wrap gap-2", hasDescription && "mb-3")}>
          {tags?.map((tag) => (
            <span
              key={tag}
              className={cn(
                "px-2 py-1 border border-border text-[10px] uppercase tracking-wider text-muted-foreground",
                variant === "compact" && "font-mono",
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {hasDescription && (
        <p
          className={cn(
            "text-muted-foreground max-w-3xl",
            variant === "compact"
              ? "font-mono text-sm"
              : "text-lg leading-relaxed",
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}

export function DocsPageBody({ children }: { children: ReactNode }) {
  return (
    <Typography variant="prose">
      {children}
    </Typography>
  )
}
