"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type CardFooterProps = ComponentPropsWithRef<"div">;

export function CardFooter({ className, ...props }: CardFooterProps) {
  return (
    <div data-slot="card-footer" className={cn("flex justify-end gap-3 border-t border-border bg-background/50 px-6 py-4", className)} {...props} />
  );
}
