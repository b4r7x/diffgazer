import { Skeleton } from "@/components/ui/skeleton"

export default function SkeletonDefault() {
  return (
    <div className="flex flex-col gap-3 w-64">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}
