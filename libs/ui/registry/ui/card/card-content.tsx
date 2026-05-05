"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type CardContentProps = ComponentPropsWithRef<"div">;

export function CardContent({ className, ...props }: CardContentProps) {
  return <div data-slot="card-content" className={cn("p-6", className)} {...props} />;
}
