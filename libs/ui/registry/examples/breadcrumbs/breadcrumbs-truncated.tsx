import { Breadcrumbs } from "@/components/ui/breadcrumbs";

// Breadcrumbs renders the trail it is given. In a constrained column, collapse
// the middle levels into Breadcrumbs.Ellipsis and clip the long leaf crumb
// instead of letting the trail wrap across three rows.
export default function BreadcrumbsTruncated() {
  return (
    <div className="flex w-[280px] flex-col gap-4 border border-dashed border-foreground/20 p-3">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
          full trail
        </span>
        {/* Two trails in one demo: each nav landmark needs its own name. */}
        <Breadcrumbs aria-label="Full breadcrumb trail">
          <Breadcrumbs.Item>
            <Breadcrumbs.Link href="/ui">UI</Breadcrumbs.Link>
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>
            <Breadcrumbs.Link href="/ui/docs">Docs</Breadcrumbs.Link>
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>
            <Breadcrumbs.Link href="/ui/docs/components">Components</Breadcrumbs.Link>
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>
            <Breadcrumbs.Link href="/ui/docs/components/navigation">Navigation</Breadcrumbs.Link>
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>Breadcrumbs component</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
          collapsed + clipped leaf
        </span>
        <Breadcrumbs aria-label="Collapsed breadcrumb trail">
          <Breadcrumbs.Item>
            <Breadcrumbs.Link href="/ui">UI</Breadcrumbs.Link>
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>
            <Breadcrumbs.Ellipsis label="3 collapsed levels" />
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>
            {/* title keeps the full text reachable on hover once it is clipped */}
            <span className="block max-w-[14ch] truncate" title="Breadcrumbs component">
              Breadcrumbs component
            </span>
          </Breadcrumbs.Item>
        </Breadcrumbs>
      </div>
    </div>
  );
}
