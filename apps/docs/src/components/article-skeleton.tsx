import { Skeleton } from "@diffgazer/ui/components/skeleton";

export function ArticleSkeleton({ label, eyebrow = false }: { label: string; eyebrow?: boolean }) {
  return (
    <>
      <output className="sr-only">{label}</output>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-3">
          {eyebrow ? <Skeleton className="h-3 w-24" /> : null}
          <Skeleton className="h-9 w-2/5" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </>
  );
}
