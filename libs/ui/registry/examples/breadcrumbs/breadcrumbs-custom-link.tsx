"use client";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";

// Simulated framework link component (replace with Next.js Link, React Router NavLink, etc.).
function AppLink(
  props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { ref?: React.Ref<HTMLAnchorElement> },
) {
  return <a {...props} />;
}

// This demo's own styling, passed through Breadcrumbs.Link's className, so the
// render-prop path is visibly distinct from the plain-anchor default.
const FRAMEWORK_LINK_CLASS = "underline decoration-dotted underline-offset-4 text-foreground/80";

export default function BreadcrumbsCustomLink() {
  return (
    <div className="flex flex-col gap-2">
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link className={FRAMEWORK_LINK_CLASS}>
            {(props) => (
              <AppLink href="/ui/docs" {...props}>
                Docs
              </AppLink>
            )}
          </Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link className={FRAMEWORK_LINK_CLASS}>
            {(props) => (
              <AppLink href="/ui/docs/components" {...props}>
                Components
              </AppLink>
            )}
          </Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>Breadcrumbs</Breadcrumbs.Item>
      </Breadcrumbs>
      <p className="text-2xs font-mono text-muted-foreground">
        The dotted links are rendered by the framework Link component; className, ref, and
        aria-current arrive through the render prop.
      </p>
    </div>
  );
}
