"use client";

import { useId } from "react";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEventHandler,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from "react";

import { resolveSidebarIntent, type SidebarIntent } from "@/lib/sidebar-intent";
import { sidebarItemVariants, type SidebarVariant } from "@/lib/sidebar-variants";
import { cn } from "@/lib/utils";
import { useSidebarChrome } from "./sidebar-context";

export interface SidebarItemRenderProps {
  ref?: Ref<HTMLElement>;
  className: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  "aria-current"?: "page";
  "aria-disabled"?: boolean;
  "data-active"?: "true";
  "data-intent"?: SidebarIntent;
  "data-diffgazer-navigation-item"?: "button";
  "data-value"?: string;
  "data-disabled"?: "";
  tabIndex?: number;
}

interface SidebarItemSharedProps {
  active?: boolean;
  value?: string;
  /**
   * Optional intent for `data-intent`. When `autoTone` is enabled on the
   * parent `<Sidebar>` and `intent` is omitted, the intent is inferred from
   * `value` via the built-in dictionary. Color is decoration only
   * (WCAG 1.4.1) — provide a text/glyph cue alongside (label or badge).
   */
  intent?: SidebarIntent;
  /**
   * Either a renderable node (icon, label, badge) or a render-prop callback
   * that receives the wired-up props for composing a custom element such as a
   * framework `<Link>`.
   *
   * Render-prop consumers compose their own decoration — the caret/bracket
   * variant glyph and the `autoTone` intent dot are NOT injected automatically
   * through the render prop. Use the built-in element rendering (`as="a"` or
   * `as="button"`) to get the glyph and dot for free, or replicate them in
   * your render callback.
   */
  children: ReactNode | ((props: SidebarItemRenderProps) => ReactNode);
  className?: string;
  disabled?: boolean;
}

export interface SidebarItemAsAnchorProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "value">,
    SidebarItemSharedProps {
  as?: "a";
  ref?: Ref<HTMLAnchorElement>;
}

export interface SidebarItemAsButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "disabled" | "value">,
    SidebarItemSharedProps {
  as: "button";
  ref?: Ref<HTMLButtonElement>;
}

export type SidebarItemProps = SidebarItemAsAnchorProps | SidebarItemAsButtonProps;

const INTENT_DOT_CLASSES: Record<SidebarIntent, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-[var(--info,oklch(0.62_0.20_240))]",
  success: "bg-[var(--success,oklch(0.62_0.20_145))]",
  warning: "bg-[var(--warning,oklch(0.62_0.20_75))]",
  danger: "bg-[var(--danger,oklch(0.62_0.20_25))]",
  accent: "bg-[var(--accent,oklch(0.62_0.20_295))]",
};

/**
 * Glyph prefix for `caret` and `bracket` variants. Rendered as `aria-hidden`
 * so screen readers skip it — the label text remains the sole accessible
 * name. Brackets stay visible for inactive rows per spec, with monospaced
 * tabular alignment ensuring no width-shift on selection. Hidden in rail mode
 * so items collapse to icon-only rows centered in the 48px rail.
 */
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
  return null;
}

function IntentDot({ intent }: { intent: SidebarIntent }) {
  return (
    <span
      aria-hidden="true"
      data-intent={intent}
      className={cn(
        "inline-block w-1.5 h-1.5 shrink-0 mr-1 group-data-[state=rail]/sidebar:hidden",
        INTENT_DOT_CLASSES[intent],
      )}
    />
  );
}

/**
 * Renders as `<a>` by default (the spec contract — items are navigation links
 * unless explicitly action buttons). Pass `as="button"` for non-navigation
 * actions (e.g. toggles, ephemeral commands). The render-prop variant
 * `{children}` as function applies when integrating with framework Link
 * components (TanStack Router `<Link>`, Next.js `<Link>`).
 */
export function SidebarItem(props: SidebarItemProps): ReactNode {
  const generatedId = useId();
  const { variant, autoTone } = useSidebarChrome();

  const active = props.active ?? false;
  const disabled = props.disabled ?? false;
  const resolvedValue = props.value ?? generatedId;
  const resolvedIntent = autoTone ? resolveSidebarIntent(props.intent, props.value) : props.intent;

  const guardedClick = (onClick?: MouseEventHandler<HTMLElement>): MouseEventHandler<HTMLElement> =>
    (event) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    };

  const sharedProps = {
    className: cn(sidebarItemVariants({ variant }), props.className),
    "aria-current": active ? ("page" as const) : undefined,
    "aria-disabled": disabled || undefined,
    "data-active": active ? ("true" as const) : undefined,
    "data-intent": resolvedIntent,
    "data-diffgazer-navigation-item": "button" as const,
    "data-value": resolvedValue,
    "data-disabled": disabled ? ("" as const) : undefined,
    tabIndex: disabled ? -1 : undefined,
  };

  if (typeof props.children === "function") {
    return props.children({
      ref: props.ref as Ref<HTMLElement>,
      disabled: disabled || undefined,
      onClick: guardedClick(props.onClick as MouseEventHandler<HTMLElement> | undefined),
      ...sharedProps,
    });
  }

  const glyph = <VariantGlyph variant={variant} active={active} />;
  const dot = resolvedIntent ? <IntentDot intent={resolvedIntent} /> : null;

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
        {dot}
        {glyph}
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
    <a
      {...anchorProps}
      ref={ref}
      {...sharedProps}
      onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {dot}
      {glyph}
      {children}
    </a>
  );
}
