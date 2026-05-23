"use client";

import { Children, type ReactNode, type MouseEvent, type FocusEvent, useEffect, useId, useMemo } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import { useNavigationListContext } from "./navigation-list-context";
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
  headerId?: string;
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
  headerId: controlledHeaderId,
  children,
  className,
}: NavigationListGroupProps) {
  const parentGroup = useNavigationListGroupContext();
  const position = useNavigationListGroupPositionContext();
  const generatedId = useId();
  const headerId = variant === "tree" ? (controlledHeaderId ?? `__group_${generatedId}`) : undefined;

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
        <SectionHeader label={label} count={count} expanded={expanded} toggle={toggle} />
      ) : (
        <TreeHeader
          headerId={headerId!}
          label={label}
          expanded={expanded}
          toggle={toggle}
          depth={depth}
          parentLinePrefix={parentGroup.linePrefix}
          isLast={position?.isLast ?? false}
        />
      )}
      {expanded && wrappedChildren}
    </div>
  );
}

function SectionHeader({ label, count, expanded, toggle }: {
  label: string;
  count?: number;
  expanded: boolean;
  toggle: () => void;
}) {
  return (
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
  );
}

function TreeHeader({ headerId, label, expanded, toggle, depth, parentLinePrefix, isLast }: {
  headerId: string;
  label: string;
  expanded: boolean;
  toggle: () => void;
  depth: number;
  parentLinePrefix: string;
  isLast: boolean;
}) {
  const { highlighted, highlight, focusContainer, focused, idPrefix, registerGroupHeader, unregisterGroupHeader } =
    useNavigationListContext();

  const itemId = getEncodedListboxItemId(idPrefix, headerId);
  const isHighlighted = highlighted === headerId;
  const isActive = focused && isHighlighted;

  useEffect(() => {
    registerGroupHeader(headerId, { toggle, expanded });
    return () => unregisterGroupHeader(headerId);
  }, [headerId, toggle, expanded, registerGroupHeader, unregisterGroupHeader]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    toggle();
    highlight(headerId);
    focusContainer();
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.defaultPrevented) highlight(headerId);
  };

  return (
    <div
      id={itemId}
      role="option"
      aria-selected={false}
      data-value={headerId}
      data-active={isActive || undefined}
      data-group-header="true"
      data-expanded={expanded}
      onClick={handleClick}
      onFocus={handleFocus}
      className={cn(
        "flex w-full items-center py-0.5 font-mono text-sm cursor-pointer select-none",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
      )}
    >
      {depth > 1 && (
        <span aria-hidden="true" className="text-muted-foreground font-mono">
          {parentLinePrefix}
          {isLast ? "└── " : "├── "}
        </span>
      )}
      <Chevron open={expanded} size="sm" className={depth > 1 ? "mx-1" : "mr-1"} />
      <span>{label}/</span>
    </div>
  );
}
