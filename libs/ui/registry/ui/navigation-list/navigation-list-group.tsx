"use client";

import { Children, type ReactNode, useMemo } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import {
  NavigationListGroupContext,
  NavigationListGroupPositionContext,
  useNavigationListGroupContext,
  useNavigationListGroupPositionContext,
} from "./navigation-list-group-context";

export interface NavigationListGroupProps {
  label: string;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  count?: number;
  variant?: "tree" | "section";
  children: ReactNode;
  className?: string;
}

export function NavigationListGroup({
  label,
  expanded: controlledExpanded,
  defaultExpanded = true,
  onExpandedChange,
  count,
  variant = "section",
  children,
  className,
}: NavigationListGroupProps) {
  const parentGroup = useNavigationListGroupContext();
  const position = useNavigationListGroupPositionContext();

  const [expanded, setExpanded] = useControllableState<boolean>({
    value: controlledExpanded,
    defaultValue: defaultExpanded,
    onChange: onExpandedChange,
  });

  const depth = variant === "tree" ? parentGroup.depth + 1 : 0;

  const linePrefix = useMemo(() => {
    if (variant !== "tree") return "";
    if (depth <= 1) return "";
    const isLast = position?.isLast ?? false;
    return parentGroup.linePrefix + (isLast ? "    " : "│   ");
  }, [variant, depth, position?.isLast, parentGroup.linePrefix]);

  const toggle = () => setExpanded((prev) => !prev);

  const arrayChildren = Children.toArray(children);

  const groupContextValue = useMemo(
    () => ({ variant, depth, linePrefix }),
    [variant, depth, linePrefix],
  );

  const groupLabel =
    variant === "section" && count !== undefined
      ? `${label} (${count})`
      : label;

  const wrappedChildren = (
    <NavigationListGroupContext value={groupContextValue}>
      {arrayChildren.map((child, index) => (
        <NavigationListGroupPositionContext
          key={index}
          value={{ isLast: index === arrayChildren.length - 1 }}
        >
          {child}
        </NavigationListGroupPositionContext>
      ))}
    </NavigationListGroupContext>
  );

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={cn(
        variant === "section" && "border-t border-border first:border-t-0",
        className,
      )}
    >
      {variant === "section" ? (
        <div
          aria-hidden="true"
          onClick={toggle}
          className="flex w-full items-center gap-1 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-mono cursor-pointer select-none hover:text-foreground/80"
          data-expanded={expanded}
        >
          <span className="text-[10px]">{expanded ? "▼" : "▶"}</span>
          <span>{label}</span>
          {count !== undefined && <span>({count})</span>}
        </div>
      ) : (
        <div
          aria-hidden="true"
          onClick={toggle}
          className="flex w-full items-center py-0.5 text-muted-foreground font-mono text-sm cursor-pointer select-none hover:text-foreground/80"
          data-expanded={expanded}
        >
          {depth > 1 && (
            <span className="text-muted-foreground font-mono">
              {parentGroup.linePrefix}
              {position?.isLast ? "└── " : "├── "}
            </span>
          )}
          <Chevron open={expanded} size="sm" className={depth > 1 ? "mx-1" : "mr-1"} />
          <span>{label}/</span>
        </div>
      )}
      {expanded && wrappedChildren}
    </div>
  );
}
