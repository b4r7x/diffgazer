"use client";

import { Children, type HTMLAttributes, isValidElement, type ReactNode, type Ref, useId, useMemo } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { cn } from "@/lib/utils";
import { SidebarSectionContext } from "./sidebar-section-context";
import { SidebarSectionTitle } from "./sidebar-section-title";

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
      {/* biome-ignore lint/a11y/useSemanticElements: role="group" labels a collapsible sidebar section; <fieldset> is for form controls and is not appropriate here. */}
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
