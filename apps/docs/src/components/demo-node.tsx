import { Spinner } from "@diffgazer/ui/components/spinner";
import { type ComponentType, type LazyExoticComponent, Suspense } from "react";

const EMPTY_FALLBACK = <div aria-hidden="true" className="h-full w-full" />;

const LOADING_FALLBACK = (
  <div className="flex h-full w-full items-center justify-center">
    <Spinner variant="pulse" size="sm" />
  </div>
);

/** Renders a lazily-loaded example, or a silent placeholder when a page has none. */
export function DemoNode({ demo: Demo }: { demo: LazyExoticComponent<ComponentType> | null }) {
  if (!Demo) return EMPTY_FALLBACK;
  return (
    <Suspense fallback={LOADING_FALLBACK}>
      <Demo />
    </Suspense>
  );
}
