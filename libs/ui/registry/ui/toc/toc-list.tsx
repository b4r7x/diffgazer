"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export type TocListProps = ComponentPropsWithRef<"ul">;

export function TocList({ className, children, ref, ...props }: TocListProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: this already is a <ul>; the explicit role="list" below restores list semantics that Tailwind preflight strips, and Biome should not suggest swapping the element.
    <ul
      ref={ref}
      // biome-ignore lint/a11y/noRedundantRoles: Tailwind preflight sets list-style:none on <ul>, which drops list semantics in Safari/VoiceOver; role="list" restores them.
      role="list"
      className={cn("border-l border-border flex flex-col gap-1.5", className)}
      {...props}
    >
      {children}
    </ul>
  );
}