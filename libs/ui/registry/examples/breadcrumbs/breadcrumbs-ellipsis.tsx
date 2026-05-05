import { Breadcrumbs } from "@/components/ui/breadcrumbs"

export default function BreadcrumbsEllipsis() {
  return (
    <Breadcrumbs>
      <Breadcrumbs.Item>
        <Breadcrumbs.Link href="/ui/docs">Docs</Breadcrumbs.Link>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>
        <Breadcrumbs.Ellipsis />
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>Breadcrumbs</Breadcrumbs.Item>
    </Breadcrumbs>
  )
}
