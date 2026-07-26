import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonDefault() {
  return (
    <div className="flex flex-col gap-3 w-64">
      {/* chars reserves the width of the value each row stands in for: a
          7-character sha next to a 12-character path. */}
      <div className="flex items-center gap-3">
        <Skeleton chars={7} className="h-4" />
        <Skeleton chars={12} className="h-4" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
