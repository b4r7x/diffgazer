import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonComposed() {
  return (
    <div className="w-full max-w-sm border border-border" aria-busy="true">
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Skeleton className="size-8" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <div className="flex items-center justify-between gap-4 pt-1">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      </div>
    </div>
  );
}
