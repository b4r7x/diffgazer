"use client";

import {
  Children,
  isValidElement,
  type ComponentPropsWithRef,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  useMemo,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
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
  },
  defaultVariants: {
    active: false,
    disabled: false,
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

type Density = NonNullable<VariantProps<typeof contentVariants>["density"]>;

function hasDescriptionChild(children: ReactNode, childType: typeof NavigationListMeta | typeof NavigationListSubtitle): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === childType) return true;
    return hasDescriptionChild(child.props.children, childType);
  });
}

export interface NavigationListItemProps
  extends Omit<
    ComponentPropsWithRef<"div">,
    "id" | "children" | "role" | "aria-selected" | "aria-disabled" | "aria-labelledby" | "aria-describedby"
  > {
  id: string;
  density?: Density;
  disabled?: boolean;
  children: ReactNode;
}

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
  const { selectedId, highlighted, activate, highlight, focusContainer, focused, idPrefix, indicator } =
    useNavigationListContext();
  const groupContext = useNavigationListGroupContext();
  const positionContext = useNavigationListGroupPositionContext();
  const isTree = groupContext.variant === "tree" && groupContext.depth > 0;
  const isSelected = !disabled && selectedId === id;
  const isHighlighted = !disabled && highlighted === id;
  const hasHighlight = highlighted !== null;
  const isActive = !disabled && focused && (hasHighlight ? isHighlighted : isSelected);
  const itemId = getEncodedListboxItemId(idPrefix, id);
  const labelId = `${itemId}-label`;
  const descId = `${itemId}-desc`;
  const describedBy = [
    hasDescriptionChild(children, NavigationListMeta) ? `${descId}-meta` : null,
    hasDescriptionChild(children, NavigationListSubtitle) ? `${descId}-sub` : null,
  ].filter(Boolean).join(" ") || undefined;

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

  const itemContextValue = useMemo(
    () => ({ labelId, descId, isTree }),
    [labelId, descId, isTree],
  );

  return (
    <NavigationListItemContext value={itemContextValue}>
      <div
        {...rootProps}
        ref={ref}
        id={itemId}
        role="option"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        data-value={id}
        data-active={isActive || undefined}
        data-state={isSelected ? "selected" : "unselected"}
        aria-selected={isSelected}
        aria-disabled={disabled || undefined}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onFocus={handleFocus}
        className={cn(
          isTree
            ? cn("flex cursor-pointer group", disabled && "opacity-50 cursor-not-allowed")
            : itemVariants({ active: isActive, disabled }),
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
          className,
        )}
      >
        {isTree && (
          <span aria-hidden="true" className="text-muted-foreground font-mono text-sm select-none shrink-0 self-center leading-none">
            {groupContext.linePrefix}{positionContext?.isLast ? "└── " : "├── "}
          </span>
        )}
        {isTree ? (
          <div className={cn(
            "flex-1 flex items-center rounded-sm",
            isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
          )}>
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
                  isActive
                    ? indicator === "bar" ? "bg-primary-foreground/40" : "bg-primary-foreground"
                    : "bg-transparent group-hover:bg-muted",
                ],
                (indicator === "arrow" || indicator === "bracket") && "w-1 bg-transparent",
              )}
            />
            <div className={contentVariants({ density })}>
              {children}
            </div>
          </>
        )}
      </div>
    </NavigationListItemContext>
  );
}
