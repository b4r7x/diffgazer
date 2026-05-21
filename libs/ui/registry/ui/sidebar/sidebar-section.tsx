"use client";

import { Children, isValidElement, useId, useMemo, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { SidebarSectionContext } from "./sidebar-section-context";
import { SidebarSectionTitle } from "./sidebar-section-title";

export interface SidebarSectionProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  collapsible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

/**
 * Group container. When `collapsible`, follows the ARIA disclosure pattern —
 * the `<SidebarSectionTitle>` renders an `<hN><button aria-expanded …>…</button></hN>`
 * that controls a sibling `<SidebarSectionContent>` panel (id wired via
 * context). Items NOT wrapped in `<SidebarSectionContent>` render unhidden;
 * this keeps non-collapsible sections trivial to compose.
 */
export function SidebarSection({
  ref,
  collapsible = false,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = true,
  className,
  children,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: SidebarSectionProps) {
  const titleId = useId();
  const panelId = useId();
  const labelSourceId = ariaLabelledBy ?? (containsSidebarSectionTitleElement(children) ? titleId : undefined);

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
      panelId,
    }),
    [collapsible, isOpen, setIsOpen, titleId, panelId],
  );

  return (
    <SidebarSectionContext value={contextValue}>
      <div
        {...rest}
        ref={ref}
        role="group"
        aria-labelledby={labelSourceId}
        data-state={isOpen ? "open" : "closed"}
        className={cn("mb-4", className)}
      >
        {children}
      </div>
    </SidebarSectionContext>
  );
}

function containsSidebarSectionTitleElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === SidebarSectionTitle) return true;
    return containsSidebarSectionTitleElement(child.props.children);
  });
}
