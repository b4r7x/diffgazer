import { useLocation } from "@tanstack/react-router"
import {
  Breadcrumbs as BreadcrumbsBase,
  BreadcrumbsItem,
} from "@/components/ui/breadcrumbs"

export function Breadcrumbs() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const parts = pathname.split("/").filter(Boolean).slice(1) // remove "docs" prefix

  if (parts.length <= 1) return null

  return (
    <BreadcrumbsBase className="capitalize">
      {parts.map((part, i) => {
        const href = "/" + ["docs", ...parts.slice(0, i + 1)].join("/")
        return (
          <BreadcrumbsItem key={href} href={href}>
            {part.replace(/-/g, " ")}
          </BreadcrumbsItem>
        )
      })}
    </BreadcrumbsBase>
  )
}
