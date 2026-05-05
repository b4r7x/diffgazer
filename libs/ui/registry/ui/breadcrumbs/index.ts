import { Breadcrumbs as BreadcrumbsRoot, type BreadcrumbsProps } from "./breadcrumbs"
import { BreadcrumbsEllipsis, type BreadcrumbsEllipsisProps } from "./breadcrumbs-ellipsis"
import { BreadcrumbsItem, type BreadcrumbsItemProps } from "./breadcrumbs-item"
import { BreadcrumbsLink, type BreadcrumbsLinkProps, type BreadcrumbsLinkRenderProps } from "./breadcrumbs-link"

const Breadcrumbs = Object.assign(BreadcrumbsRoot, {
  Item: BreadcrumbsItem,
  Link: BreadcrumbsLink,
  Ellipsis: BreadcrumbsEllipsis,
})

export { Breadcrumbs, type BreadcrumbsProps }
export { BreadcrumbsEllipsis, type BreadcrumbsEllipsisProps }
export { BreadcrumbsItem, type BreadcrumbsItemProps }
export { BreadcrumbsLink, type BreadcrumbsLinkProps, type BreadcrumbsLinkRenderProps }
