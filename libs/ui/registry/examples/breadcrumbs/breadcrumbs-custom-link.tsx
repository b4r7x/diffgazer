import { Breadcrumbs } from "@/components/ui/breadcrumbs"

// Simulated framework link component (replace with Next.js Link, React Router NavLink, etc.)
function AppLink(props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { ref?: React.Ref<HTMLAnchorElement> }) {
  return <a {...props} />
}

export default function BreadcrumbsCustomLink() {
  return (
    <Breadcrumbs>
      <Breadcrumbs.Item>
        <Breadcrumbs.Link>
          {(props) => <AppLink href="/ui/docs" {...props}>Docs</AppLink>}
        </Breadcrumbs.Link>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>
        <Breadcrumbs.Link>
          {(props) => <AppLink href="/ui/docs/components" {...props}>Components</AppLink>}
        </Breadcrumbs.Link>
      </Breadcrumbs.Item>
      <Breadcrumbs.Item>Breadcrumbs</Breadcrumbs.Item>
    </Breadcrumbs>
  )
}
