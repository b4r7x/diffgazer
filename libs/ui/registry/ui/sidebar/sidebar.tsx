"use client";

import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { useOptionalSidebar } from "./sidebar-context";
import { SidebarProvider } from "./sidebar-provider";

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: ReactNode;
}

function SidebarNav({ ref, className, ...rest }: HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }) {
  return (
    <nav ref={ref} aria-label="Sidebar" {...rest} className={cn("flex flex-col h-full", className)} />
  );
}

export function Sidebar({
  ref,
  open,
  onOpenChange,
  defaultOpen = true,
  children,
  className,
  ...rest
}: SidebarProps) {
  const existingContext = useOptionalSidebar();

  if (existingContext) {
    return <SidebarNav ref={ref} className={className} {...rest}>{children}</SidebarNav>;
  }

  return (
    <SidebarProvider
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
    >
      <SidebarNav ref={ref} className={className} {...rest}>{children}</SidebarNav>
    </SidebarProvider>
  );
}
