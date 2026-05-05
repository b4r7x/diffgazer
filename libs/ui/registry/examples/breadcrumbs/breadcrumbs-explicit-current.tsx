import { Breadcrumbs } from "@/components/ui/breadcrumbs"

export default function BreadcrumbsExplicitCurrent() {
  return (
    <Breadcrumbs>
      <Breadcrumbs.Item>
        <Breadcrumbs.Link href="/ui/docs">Docs</Breadcrumbs.Link>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item current>
        <Breadcrumbs.Link href="/ui/docs/components">Components</Breadcrumbs.Link>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>Breadcrumbs</Breadcrumbs.Item>
    </Breadcrumbs>
  )
}
