"use client";

import {
  Children,
  type FocusEvent,
  isValidElement,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
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

/** Props for navigation list group. */
export interface NavigationListGroupProps {
  /** Group header text. */
  label: string;
  /** Controlled expanded state. */
  expanded?: boolean;
  /** Initial expanded state for uncontrolled mode. */
  defaultExpanded?: boolean;
  /** Fired when expanded state changes. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Optional count shown next to the label in section variant. */
  count?: number;
  /**
   * Visual treatment. "section" shows uppercase headers with counts, "tree" shows indented
   * hierarchy with ASCII connectors.
   */
  variant?: "tree" | "section";
  /** Stable header identity. Defaults to a per-instance generated value. */
  headerId?: string;
  /** Accessible action word appended to the header name while collapsed. Defaults to "expand". */
  expandLabel?: string;
  /** Accessible action word appended to the header name while expanded. Defaults to "collapse". */
  collapseLabel?: string;
  /** NavigationList.Item or nested NavigationList.Group children. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Collapsible group with header (section or tree variant) */
export function NavigationListGroup({
  label,
  expanded: controlledExpanded,
  defaultExpanded = true,
  onExpandedChange,
  count,
  variant = "section",
  headerId: controlledHeaderId,
  expandLabel = "expand",
  collapseLabel = "collapse",
  children,
  className,
}: NavigationListGroupProps) {
  const parentGroup = useNavigationListGroupContext();
  const position = useNavigationListGroupPositionContext();
  const generatedId = useId();
  const headerId = controlledHeaderId ?? `__group_${generatedId}`;

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

  const toggle = useCallback(() => setExpanded((prev) => !prev), [setExpanded]);

  const arrayChildren = Children.toArray(children);

  const groupContextValue = useMemo(
    () => ({ variant, depth, linePrefix }),
    [variant, depth, linePrefix],
  );

  const groupLabel = variant === "section" && count !== undefined ? `${label} (${count})` : label;

  const wrappedChildren = (
    <NavigationListGroupContext value={groupContextValue}>
      {/* Children.toArray preserves explicit keys and gives unkeyed elements positional keys. */}
      {arrayChildren.map((child, index) => (
        <NavigationListGroupPositionContext
          key={isValidElement(child) && child.key !== null ? child.key : index}
          value={{ isLast: index === arrayChildren.length - 1 }}
        >
          {child}
        </NavigationListGroupPositionContext>
      ))}
    </NavigationListGroupContext>
  );

  if (variant === "section") {
    return (
      <div className={cn("border-t border-border first:border-t-0", className)}>
        <NavigationListGroupHeader
          variant="section"
          headerId={headerId}
          label={label}
          count={count}
          expanded={expanded}
          toggle={toggle}
          expandLabel={expandLabel}
          collapseLabel={collapseLabel}
        />
        {expanded && wrappedChildren}
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="group" labels a related set of navigation options; <fieldset> is for form controls and is not appropriate here.
    <div role="group" aria-label={groupLabel} className={className}>
      <NavigationListGroupHeader
        variant="tree"
        headerId={headerId}
        label={label}
        expanded={expanded}
        toggle={toggle}
        depth={depth}
        parentLinePrefix={parentGroup.linePrefix}
        isLast={position?.isLast ?? false}
        expandLabel={expandLabel}
        collapseLabel={collapseLabel}
      />
      {expanded && wrappedChildren}
    </div>
  );
}

function useNavigationListGroupHeader({
  headerId,
  accessibleLabel,
  expanded,
  toggle,
}: {
  headerId: string;
  accessibleLabel: string;
  expanded: boolean;
  toggle: () => void;
}) {
  const {
    highlighted,
    highlight,
    focusContainer,
    focused,
    idPrefix,
    registerItem,
    unregisterItem,
    registerGroupHeader,
    unregisterGroupHeader,
  } = useNavigationListContext();
  const registrationId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const itemId = getEncodedListboxItemId(idPrefix, headerId);
  const isHighlighted = highlighted === headerId;
  const isActive = focused && isHighlighted;

  useLayoutEffect(() => {
    registerItem(registrationId, headerId, false, rootRef.current);
    return () => unregisterItem(registrationId);
  }, [registerItem, unregisterItem, registrationId, headerId]);

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

  return { rootRef, itemId, isActive, accessibleLabel, handleClick, handleFocus };
}

function NavigationListGroupHeader({
  variant,
  headerId,
  label,
  count,
  expanded,
  toggle,
  depth = 0,
  parentLinePrefix = "",
  isLast = false,
  expandLabel,
  collapseLabel,
}: {
  variant: "tree" | "section";
  headerId: string;
  label: string;
  count?: number;
  expanded: boolean;
  toggle: () => void;
  depth?: number;
  parentLinePrefix?: string;
  isLast?: boolean;
  expandLabel: string;
  collapseLabel: string;
}) {
  const isTree = variant === "tree";
  const header = useNavigationListGroupHeader({
    headerId,
    accessibleLabel: isTree || count === undefined ? label : `${label} (${count})`,
    expanded,
    toggle,
  });

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: WAI-ARIA listbox pattern — this collapsible group header is an option that stays non-focusable while the container holds focus and aria-activedescendant tracks the active option.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Enter/Space toggle is handled centrally by the navigation list container, not per header.
    <div
      ref={header.rootRef}
      id={header.itemId}
      role="option"
      aria-selected={false}
      aria-label={`${header.accessibleLabel}, ${expanded ? collapseLabel : expandLabel} section`}
      data-value={headerId}
      data-highlighted={header.isActive ? "" : undefined}
      data-group-header="true"
      data-expanded={expanded}
      onClick={header.handleClick}
      onFocus={header.handleFocus}
      className={cn(
        isTree
          ? "flex w-full items-center py-0.5 font-mono text-sm cursor-pointer select-none"
          : "flex w-full items-center gap-1 px-3 py-2 text-[11px] uppercase tracking-wider font-mono cursor-pointer select-none",
        header.isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
      )}
    >
      {isTree && depth > 1 && (
        <span aria-hidden="true" className="text-muted-foreground font-mono">
          {parentLinePrefix}
          {isLast ? "└── " : "├── "}
        </span>
      )}
      <Chevron
        open={expanded}
        size="sm"
        className={cn(isTree && depth > 1 && "mx-1", isTree && depth <= 1 && "mr-1")}
      />
      <span aria-hidden="true">{isTree ? `${label}/` : label}</span>
      {!isTree && count !== undefined && <span aria-hidden="true">({count})</span>}
    </div>
  );
}
