"use client";

import { useId, useMemo, type HTMLAttributes, type Ref } from "react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { SidebarSectionContext } from "./sidebar-section-context";

export interface SidebarSectionProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  collapsible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

export function SidebarSection({
  ref,
  collapsible = false,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = true,
  className,
  children,
  ...rest
}: SidebarSectionProps) {
  const titleId = useId();

  const [isOpen, setIsOpen] = useControllableState<boolean>({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  const contextValue = useMemo(
    () => ({
      collapsible,
      open: isOpen,
      onToggle: () => setIsOpen(prev => !prev),
      titleId,
    }),
    [collapsible, isOpen, setIsOpen, titleId],
  );

  return (
    <SidebarSectionContext value={contextValue}>
      <div
        {...rest}
        ref={ref}
        role="group"
        aria-labelledby={titleId}
        data-state={isOpen ? "open" : "closed"}
        className={cn("mb-4", className)}
      >
        {children}
      </div>
    </SidebarSectionContext>
  );
}
