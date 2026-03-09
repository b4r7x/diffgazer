import { Fragment } from "react"
import { useLocation } from "@tanstack/react-router"
import {
  Breadcrumbs as BreadcrumbsBase,
} from "@/components/ui/breadcrumbs"
import { isDocsLibraryId } from "@/lib/docs-library"

export function Breadcrumbs() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const parts = pathname.split("/").filter(Boolean)
  const library = parts[0]
  const docsRoot = parts[1]

  if (!library || !isDocsLibraryId(library) || docsRoot !== "docs") return null

  const pathParts = parts.slice(2)

  if (pathParts.length === 0) return null

  return (
    <BreadcrumbsBase className="capitalize">
      <BreadcrumbsBase.List>
        {pathParts.map((part, i) => {
          const href = "/" + [library, "docs", ...pathParts.slice(0, i + 1)].join("/")
          const isLast = i === pathParts.length - 1

          return (
            <Fragment key={href}>
              {i > 0 ? <BreadcrumbsBase.Separator /> : null}
              <BreadcrumbsBase.Item>
                {isLast ? (
                  <BreadcrumbsBase.Page>{part.replace(/-/g, " ")}</BreadcrumbsBase.Page>
                ) : (
                  <BreadcrumbsBase.Link href={href}>{part.replace(/-/g, " ")}</BreadcrumbsBase.Link>
                )}
              </BreadcrumbsBase.Item>
            </Fragment>
          )
        })}
      </BreadcrumbsBase.List>
    </BreadcrumbsBase>
  )
}
