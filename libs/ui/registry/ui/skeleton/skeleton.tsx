import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Props for skeleton. */
export type SkeletonProps = Omit<ComponentProps<"div">, "aria-hidden">;

/** Decorative placeholder div. Use className to set width and height. */
export function Skeleton({ className, ref, ...props }: SkeletonProps) {
  return (
    <div
      ref={ref}
      data-slot="skeleton"
      className={cn("rounded-sm bg-secondary motion-safe:animate-pulse", className)}
      {...props}
      aria-hidden="true"
    />
  );
}
