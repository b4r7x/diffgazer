import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export function Skeleton({ className, ref, ...props }: SkeletonProps) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("rounded-sm bg-secondary motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
