"use client";

import { cva } from "class-variance-authority";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from "react";

import { cn } from "@/lib/utils";
import { useOptionalSidebarSectionContext } from "./sidebar-section-context";

const sidebarItemVariants = cva(
  "flex items-center gap-2 w-full min-w-0 px-2 py-1 rounded text-sm font-mono cursor-pointer transition-colors",
  {
    variants: {
      active: {
        true: "bg-foreground/10 text-foreground border-l-2 border-foreground",
        false: "text-foreground/70 hover:text-foreground hover:bg-secondary",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

export interface SidebarItemRenderProps {
  ref?: Ref<HTMLElement>;
  className: string;
  disabled?: boolean;
  "aria-current"?: "page";
  "data-value"?: string;
  "data-disabled"?: "";
}

interface SidebarItemSharedProps {
  active?: boolean;
  value?: string;
  children: ReactNode | ((props: SidebarItemRenderProps) => ReactNode);
  className?: string;
  disabled?: boolean;
}

export interface SidebarItemAsButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "disabled" | "value">,
    SidebarItemSharedProps {
  as?: "button";
  ref?: Ref<HTMLButtonElement>;
}

export interface SidebarItemAsAnchorProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "value">,
    SidebarItemSharedProps {
  as: "a";
  ref?: Ref<HTMLAnchorElement>;
}

export type SidebarItemProps = SidebarItemAsButtonProps | SidebarItemAsAnchorProps;

export function SidebarItem(props: SidebarItemProps) {
  const {
    active = false,
    value,
    children,
    className,
    disabled = false,
    as: elementType,
    ...rest
  } = props;

  const sectionContext = useOptionalSidebarSectionContext();

  if (sectionContext && !sectionContext.open) return null;

  const sharedProps = {
    className: cn(sidebarItemVariants({ active, disabled }), className),
    "aria-current": active ? ("page" as const) : undefined,
    "aria-disabled": disabled || undefined,
    "data-value": value,
    "data-disabled": disabled ? ("" as const) : undefined,
  };

  if (typeof children === "function") {
    return children({
      ref: props.ref as Ref<HTMLElement>,
      disabled: disabled || undefined,
      ...sharedProps,
    });
  }

  if (elementType === "a") {
    const { ref, ...anchorProps } = rest as Omit<
      SidebarItemAsAnchorProps,
      keyof SidebarItemSharedProps | "as"
    >;

    return (
      <a
        {...anchorProps}
        ref={ref}
        {...sharedProps}
        {...(disabled ? { onClick: (e: ReactMouseEvent) => e.preventDefault() } : undefined)}
      >
        {children}
      </a>
    );
  }

  const { ref, ...buttonProps } = rest as Omit<
    SidebarItemAsButtonProps,
    keyof SidebarItemSharedProps | "as"
  >;

  return (
    <button {...buttonProps} ref={ref} type="button" disabled={disabled} {...sharedProps}>
      {children}
    </button>
  );
}
