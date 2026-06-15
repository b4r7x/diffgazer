"use client";

import { cva } from "class-variance-authority";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEventHandler,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from "react";
import { isValidElement, useId } from "react";
import { cn } from "@/lib/utils";
import { useOptionalSidebar, useSidebarChrome } from "./sidebar-context";
import { resolveSidebarIntent, type SidebarIntent } from "./sidebar-intent";
import { SIDEBAR_TREE_CONNECTOR } from "./sidebar-tree-glyphs";
import { type SidebarVariant, sidebarItemVariants } from "./sidebar-variants";

/** Props for sidebar item render. */
export interface SidebarItemRenderProps {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLElement>;
  /** Additional class names merged onto the rendered element. */
  className: string;
  /** Disables the item. Adds aria-disabled and removes from tab order. */
  disabled?: boolean;
  /** Called when click occurs. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** ARIA current state forwarded to the rendered element. */
  "aria-current"?: "page";
  /** ARIA disabled state forwarded to the rendered element. */
  "aria-disabled"?: boolean;
  /** Present when the item is selected. */
  "data-selected"?: "";
  /** Intent exposed as a data attribute for styling. */
  "data-intent"?: SidebarIntent;
  /** Navigation item marker consumed by keyboard navigation helpers. */
  "data-diffgazer-navigation-item"?: "button";
  /** Value exposed as a data attribute for styling and selectors. */
  "data-value"?: string;
  /** Present when the item is disabled. */
  "data-disabled"?: "";
  /** Tab index applied to the rendered element. */
  tabIndex?: number;
  /** Tree connector / variant glyph prefix for custom link renderers. */
  itemPrefix?: ReactNode;
}

/** Props for sidebar item shared. */
interface SidebarItemSharedProps {
  /** Marks the item as active. */
  active?: boolean;
  /** Controlled value. */
  value?: string;
  /** intent used by sidebar item shared. */
  intent?: SidebarIntent;
  /** Sidebar subparts (Header, Content, Footer, Trigger). */
  children: ReactNode | ((props: SidebarItemRenderProps) => ReactNode);
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Disables interaction. */
  disabled?: boolean;
}

/** Props for sidebar item as anchor. */
export interface SidebarItemAsAnchorProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "value">,
    SidebarItemSharedProps {
  /**
   * Rendered element. Items are navigation links by default; pass as="button" for
   * non-navigation actions.
   */
  as?: "a";
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLAnchorElement>;
}

/** Props for sidebar item as button. */
export interface SidebarItemAsButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "disabled" | "value">,
    SidebarItemSharedProps {
  /**
   * Rendered element. Items are navigation links by default; pass as="button" for
   * non-navigation actions.
   */
  as: "button";
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLButtonElement>;
}

/** Props for sidebar item. */
export type SidebarItemProps = SidebarItemAsAnchorProps | SidebarItemAsButtonProps;

/** Class variants for sidebar intent dot. */
export const sidebarIntentDotVariants = cva(
  "inline-block w-1.5 h-1.5 shrink-0 mr-1 group-data-[state=rail]/sidebar:hidden",
  {
    variants: {
      intent: {
        neutral: "bg-muted-foreground",
        info: "bg-info-strong",
        success: "bg-success-strong",
        warning: "bg-warning-strong",
        danger: "bg-error-strong",
        accent: "bg-action",
      },
    },
    defaultVariants: { intent: "neutral" },
  },
);

function flattenText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).filter(Boolean).join(" ");
  if (isValidElement<{ children?: ReactNode; "aria-hidden"?: boolean | "true" | "false" }>(node)) {
    const ariaHidden = node.props["aria-hidden"];
    // Skip decorative subtrees so icon glyphs never leak into the rail name.
    if (ariaHidden === true || ariaHidden === "true") return "";
    return flattenText(node.props.children);
  }
  return "";
}

function VariantGlyph({ variant, active }: { variant: SidebarVariant; active: boolean }) {
  if (variant === "caret") {
    return (
      <span
        aria-hidden="true"
        className="inline-block w-[1ch] shrink-0 text-muted-foreground tabular-nums group-data-[state=rail]/sidebar:hidden"
      >
        ▸
      </span>
    );
  }
  if (variant === "bracket") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0 tabular-nums group-data-[state=rail]/sidebar:hidden",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {active ? "[*]" : "[ ]"}
      </span>
    );
  }
  if (variant === "terminal") {
    return (
      <span
        aria-hidden="true"
        className="inline-block w-[1ch] shrink-0 text-foreground tabular-nums group-data-[state=rail]/sidebar:hidden"
      >
        {active ? ">" : " "}
      </span>
    );
  }
  return null;
}

// Connector glyphs toggle via CSS last-child, so tree items must be direct
// siblings of their container; a non-item element after the last item (or a
// per-item wrapper element) would mislabel the connectors.
function TreeConnector({ variant }: { variant: SidebarVariant }) {
  if (variant !== "tree") return null;

  return (
    <span
      aria-hidden="true"
      className="mr-2 shrink-0 text-muted-foreground tabular-nums group-data-[state=rail]/sidebar:hidden"
    >
      <span className="group-last/tree-item:hidden">{SIDEBAR_TREE_CONNECTOR.branch}</span>
      <span className="hidden group-last/tree-item:inline">{SIDEBAR_TREE_CONNECTOR.last}</span>
    </span>
  );
}

function IntentDot({ intent }: { intent: SidebarIntent }) {
  return (
    <span
      aria-hidden="true"
      data-intent={intent}
      className={sidebarIntentDotVariants({ intent })}
    />
  );
}

/**
 * Nav row. Renders as <a> by default; pass as="button" for actions. Render-prop variant
 * supported.
 */
export function SidebarItem(props: SidebarItemProps): ReactNode {
  const generatedId = useId();
  const { variant, autoTone } = useSidebarChrome();
  const sidebar = useOptionalSidebar();
  const isRail = sidebar?.state === "rail";

  const active = props.active ?? false;
  const disabled = props.disabled ?? false;
  const resolvedValue = props.value ?? generatedId;
  const resolvedIntent = autoTone ? resolveSidebarIntent(props.intent, props.value) : props.intent;

  const guardedClick =
    (onClick?: MouseEventHandler<HTMLElement>): MouseEventHandler<HTMLElement> =>
    (event) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    };

  const sharedProps = {
    className: cn(
      variant === "tree" && "group/tree-item",
      sidebarItemVariants({ variant }),
      props.className,
    ),
    "aria-current": active ? ("page" as const) : undefined,
    "aria-disabled": disabled || undefined,
    "data-selected": active ? ("" as const) : undefined,
    "data-intent": resolvedIntent,
    "data-diffgazer-navigation-item": "button" as const,
    "data-value": resolvedValue,
    "data-disabled": disabled ? ("" as const) : undefined,
    tabIndex: disabled ? -1 : undefined,
  };

  const glyph = <VariantGlyph variant={variant} active={active} />;
  const treeConnector = <TreeConnector variant={variant} />;
  const dot = resolvedIntent ? <IntentDot intent={resolvedIntent} /> : null;
  // Rail mode display:none-hides the visible label/badge, leaving an icon-only
  // row with no accessible name. In rail state, render an sr-only copy of the
  // label so the name survives the collapse; render-prop items own their own
  // markup and supply their own name.
  const railName =
    isRail && typeof props.children !== "function" ? flattenText(props.children) : "";
  const railNameNode = railName ? <span className="sr-only">{railName}</span> : null;
  const itemPrefix = (
    <>
      {railNameNode}
      {dot}
      {treeConnector}
      {glyph}
    </>
  );

  if (typeof props.children === "function") {
    return props.children({
      ref: props.ref as Ref<HTMLElement>,
      disabled: disabled || undefined,
      onClick: guardedClick(props.onClick as MouseEventHandler<HTMLElement> | undefined),
      itemPrefix,
      ...sharedProps,
    });
  }

  if (props.as === "button") {
    const {
      active: _active,
      value: _value,
      intent: _intent,
      children,
      className: _className,
      disabled: _disabled,
      as: _as,
      ref,
      onClick,
      ...buttonProps
    } = props;
    return (
      <button
        {...buttonProps}
        ref={ref}
        type="button"
        disabled={disabled}
        {...sharedProps}
        onClick={guardedClick(onClick)}
      >
        {itemPrefix}
        {children}
      </button>
    );
  }

  const {
    active: _active,
    value: _value,
    intent: _intent,
    children,
    className: _className,
    disabled: _disabled,
    as: _as,
    ref,
    onClick,
    ...anchorProps
  } = props;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: this is a navigation anchor; href is provided by the consumer via anchorProps, so the onClick only guards the disabled state.
    <a
      {...anchorProps}
      ref={ref}
      {...sharedProps}
      // biome-ignore lint/a11y/useValidAnchor: href is supplied by the consumer through anchorProps (spread), which Biome cannot see; the onClick guards disabled navigation rather than replacing the href.
      onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {itemPrefix}
      {children}
    </a>
  );
}
