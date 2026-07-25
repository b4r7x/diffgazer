import { Pager, PagerLink } from "@/components/ui/pager";

// Simulated framework link component (replace with TanStack Link, Next.js Link, etc.).
function AppLink(
  props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { ref?: React.Ref<HTMLAnchorElement> },
) {
  return <a {...props} />;
}

// The render prop hands the framework Link the merged className, the rel
// attribute, and the direction; arrows are the consumer's to render.
export default function PagerRenderProp() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Pager>
        <PagerLink direction="previous">
          {({ className, rel, ref }) => (
            <AppLink ref={ref} href="/ui/components/toc" className={className} rel={rel}>
              <span aria-hidden="true">&larr; </span>
              TOC
            </AppLink>
          )}
        </PagerLink>
        <PagerLink direction="next">
          {({ className, rel, ref }) => (
            <AppLink ref={ref} href="/ui/components/panel" className={className} rel={rel}>
              Panel
              <span aria-hidden="true"> &rarr;</span>
            </AppLink>
          )}
        </PagerLink>
      </Pager>
    </div>
  );
}
