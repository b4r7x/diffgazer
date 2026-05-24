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

import { cva } from "class-variance-authority";
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
  intent?: SidebarIntent;
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

export const sidebarIntentDotVariants = cva(
  "inline-block w-1.5 h-1.5 shrink-0 mr-1 group-data-[state=rail]/sidebar:hidden",
  {
    variants: {
      intent: {
        neutral: "bg-muted-foreground",
        info: "bg-[var(--info,oklch(0.62_0.20_240))]",
        success: "bg-[var(--success,oklch(0.62_0.20_145))]",
        warning: "bg-[var(--warning,oklch(0.62_0.20_75))]",
        danger: "bg-[var(--danger,oklch(0.62_0.20_25))]",
        accent: "bg-[var(--accent,oklch(0.62_0.20_295))]",
      },
    },
    defaultVariants: { intent: "neutral" },
  },
);

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
      className={sidebarIntentDotVariants({ intent })}
    />
  );
}

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
