"use client";

import { cn } from "@/lib/utils";

export interface MenuDividerProps {
  className?: string;
}

export function MenuDivider({ className }: MenuDividerProps) {
  return <div role="separator" className={cn("my-1 border-t border-border mx-4 opacity-50", className)} />;
}