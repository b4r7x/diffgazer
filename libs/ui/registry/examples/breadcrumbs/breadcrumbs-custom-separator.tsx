import { Chevron } from "@/components/ui/icons"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"

export default function BreadcrumbsCustomSeparator() {
  return (
    <Breadcrumbs separator={<Chevron direction="right" size="sm" />}>
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
