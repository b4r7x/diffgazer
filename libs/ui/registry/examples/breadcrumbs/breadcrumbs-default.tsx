import { Breadcrumbs } from "@/components/ui/breadcrumbs"

export default function BreadcrumbsDefault() {
  return (
    <Breadcrumbs>
      <Breadcrumbs.Item>
        <Breadcrumbs.Link href="/ui/docs">Docs</Breadcrumbs.Link>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>
        <Breadcrumbs.Link href="/ui/docs/components">Components</Breadcrumbs.Link>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>Breadcrumbs</Breadcrumbs.Item>
    </Breadcrumbs>
  )
}
