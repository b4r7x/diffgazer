import { useLocation } from "@tanstack/react-router"
import {
  Breadcrumbs as BreadcrumbsBase,
} from "@/components/ui/breadcrumbs"
import { isDocsLibraryId } from "@/lib/docs-library"

/**
 * Sections that have index pages and can be linked.
 * Sections not listed here render as plain text to avoid 404s.
 * Validated against the `content/docs` tree by breadcrumbs.test.ts; update both
 * when adding/removing `index.mdx` files.
 */
export const SECTIONS_WITH_INDEX = new Set([
  "ui",
  "ui/cli",
  "ui/getting-started",
  "ui/hooks",
  "ui/integrations",
  "ui/patterns",
  "ui/theme",
  "ui/utils",
  "keys",
  "keys/api",
  "keys/cli",
  "keys/getting-started",
  "keys/guides",
  "keys/hooks",
])

function hasIndexPage(library: string, pathParts: string[], segmentIndex: number): boolean {
  const sectionPath = [library, ...pathParts.slice(0, segmentIndex + 1)].join("/")
  return SECTIONS_WITH_INDEX.has(sectionPath)
}

export function Breadcrumbs() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const parts = pathname.split("/").filter(Boolean)
  const library = parts[0]

  if (!library || !isDocsLibraryId(library)) return null

  const pathParts = parts.slice(1)

  if (pathParts.length === 0) return null

  return (
    <BreadcrumbsBase className="capitalize">
      {pathParts.map((part, i) => {
        const href = "/" + [library, ...pathParts.slice(0, i + 1)].join("/")
        const isLast = i === pathParts.length - 1
        const isLinkable = !isLast && hasIndexPage(library, pathParts, i)

        return (
          <BreadcrumbsBase.Item key={href} current={isLast}>
            {isLinkable ? (
              <BreadcrumbsBase.Link href={href}>{part.replace(/-/g, " ")}</BreadcrumbsBase.Link>
            ) : (
              <span>{part.replace(/-/g, " ")}</span>
            )}
          </BreadcrumbsBase.Item>
        )
      })}
    </BreadcrumbsBase>
  )
}
