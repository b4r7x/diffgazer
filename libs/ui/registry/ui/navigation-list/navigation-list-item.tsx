"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  Children,
  type ComponentPropsWithRef,
  type FocusEvent,
  isValidElement,
  type MouseEvent,
  type ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { mergeIds } from "@/lib/aria";
import { cn } from "@/lib/utils";
import { useNavigationListContext } from "./navigation-list-context";
import {
  useNavigationListGroupContext,
  useNavigationListGroupPositionContext,
} from "./navigation-list-group-context";
import { NavigationListItemContext } from "./navigation-list-item-context";
import { NavigationListMeta } from "./navigation-list-meta";
import { NavigationListSubtitle } from "./navigation-list-subtitle";

const itemVariants = cva("flex cursor-pointer group", {
  variants: {
    active: {
      true: "bg-primary text-primary-foreground",
      false: "hover:bg-secondary border-b border-border/50",
    },
    disabled: {
      true: "opacity-50 cursor-not-allowed",
    },
    tree: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [{ tree: true, active: false, className: "hover:bg-transparent border-b-0" }],
  defaultVariants: {
    active: false,
    disabled: false,
    tree: false,
  },
});

const contentVariants = cva("flex-1 grid grid-cols-[1fr_auto] auto-rows-auto gap-y-0.5", {
  variants: {
    density: {
      compact: "p-2",
      default: "p-3",
      comfortable: "p-4",
    },
  },
  defaultVariants: {
    density: "default",
  },
});

/** Allowed density values. */
type Density = NonNullable<VariantProps<typeof contentVariants>["density"]>;

function hasDescriptionChild(
  children: ReactNode,
  childType: typeof NavigationListMeta | typeof NavigationListSubtitle,
): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === childType) return true;
    return hasDescriptionChild(child.props.children, childType);
  });
}

/** Props for navigation list item. */
export interface NavigationListItemProps
  extends Omit<
    ComponentPropsWithRef<"div">,
    | "id"
    | "children"
    | "role"
    | "aria-selected"
    | "aria-disabled"
    | "aria-labelledby"
    | "aria-describedby"
  > {
  /** Stable identifier matched against selectedId/highlighted. */
  id: string;
  /** Padding scale for the item content. */
  density?: Density;
  /** Disables activation; item is rendered with aria-disabled. */
  disabled?: boolean;
  /** Item subparts (Title, Status, Meta, Badge, Subtitle). */
  children: ReactNode;
}

/** Selectable list item container. */
export function NavigationListItem({
  id,
  disabled = false,
  density = "default",
  children,
  className,
  ref,
  onClick,
  onMouseDown,
  onFocus,
  ...rootProps
}: NavigationListItemProps) {
  const {
    selectedId,
    highlighted,
    activate,
    highlight,
    focusContainer,
    focused,
    idPrefix,
    indicator,
    registerItem,
    unregisterItem,
  } = useNavigationListContext();
  const groupContext = useNavigationListGroupContext();
  const positionContext = useNavigationListGroupPositionContext();
  const registrationId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const isTree = groupContext.variant === "tree" && groupContext.depth > 0;
  const isSelected = !disabled && selectedId === id;
  const isHighlighted = !disabled && highlighted === id;
  const hasHighlight = highlighted !== null;
  const isActive = !disabled && focused && (hasHighlight ? isHighlighted : isSelected);
  const itemId = getEncodedListboxItemId(idPrefix, id);
  const labelId = `${itemId}-label`;
  const descId = `${itemId}-desc`;
  const describedBy = mergeIds(
    hasDescriptionChild(children, NavigationListMeta) ? `${descId}-meta` : undefined,
    hasDescriptionChild(children, NavigationListSubtitle) ? `${descId}-sub` : undefined,
  );

  const activeBarColorClass =
    indicator === "bar" ? "bg-primary-foreground/40" : "bg-primary-foreground";
  const indicatorColorClass = isActive
    ? activeBarColorClass
    : "bg-transparent group-hover:bg-muted";

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    activate(id);
    focusContainer();
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    onMouseDown?.(event);
    if (event.defaultPrevented) return;
    if (disabled) event.preventDefault();
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    if (!event.defaultPrevented && !disabled) highlight(id);
  };

  const itemContextValue = useMemo(() => ({ labelId, descId, isTree }), [labelId, descId, isTree]);

  useLayoutEffect(() => {
    registerItem(registrationId, id, disabled, rootRef.current);
    return () => unregisterItem(registrationId);
  }, [registerItem, unregisterItem, registrationId, id, disabled]);

  return (
    <NavigationListItemContext value={itemContextValue}>
      {/* biome-ignore lint/a11y/useFocusableInteractive: WAI-ARIA listbox pattern — option stays non-focusable while the navigation list container holds focus and aria-activedescendant tracks the active option. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Enter/Space activation is handled centrally by the navigation list container, not per option. */}
      <div
        {...rootProps}
        ref={composedRef}
        id={itemId}
        role="option"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        data-value={id}
        data-highlighted={isActive ? "" : undefined}
        data-selected={isSelected ? "" : undefined}
        aria-selected={isSelected}
        aria-disabled={disabled || undefined}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onFocus={handleFocus}
        className={cn(
          itemVariants({ active: isActive, disabled, tree: isTree || undefined }),
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
          className,
        )}
      >
        {isTree && (
          <span
            aria-hidden="true"
            className="text-muted-foreground font-mono text-sm select-none shrink-0 self-center leading-none"
          >
            {groupContext.linePrefix}
            {positionContext?.isLast ? "└── " : "├── "}
          </span>
        )}
        {isTree ? (
          <div
            className={cn(
              "flex-1 flex items-center rounded-sm",
              isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
            )}
          >
            <div className="flex-1 grid grid-cols-[1fr_auto] auto-rows-auto gap-y-0.5 py-0.5 px-1">
              {children}
            </div>
          </div>
        ) : (
          <>
            <div
              data-indicator={indicator}
              className={cn(
                "shrink-0",
                (indicator === "bar" || indicator === "bar-thick") && [
                  indicator === "bar" ? "w-1" : "w-[4px]",
                  indicatorColorClass,
                ],
                (indicator === "arrow" || indicator === "bracket") && "w-1 bg-transparent",
              )}
            />
            <div className={contentVariants({ density })}>{children}</div>
          </>
        )}
      </div>
    </NavigationListItemContext>
  );
}
