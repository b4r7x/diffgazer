"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type CardDescriptionProps = ComponentPropsWithRef<"p">;

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
