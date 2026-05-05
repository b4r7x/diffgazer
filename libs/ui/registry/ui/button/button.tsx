"use client";

import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "../spinner/spinner";

export const buttonVariants = cva(
  "inline-flex items-center justify-center font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
        secondary:
          "border border-border bg-transparent text-foreground hover:bg-secondary",
        destructive:
          "text-error-fg border border-error-border bg-transparent hover:bg-error-strong hover:text-error-strong-foreground",
        success:
          "bg-success-strong text-success-strong-foreground font-bold hover:bg-success-strong/90",
        ghost: "bg-transparent text-foreground hover:bg-secondary",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-border",
        link: "bg-transparent text-info-fg underline-offset-2 hover:underline",
        action: "bg-action text-action-foreground font-bold hover:bg-action/90",
      },
      size: {
        sm: "h-7 px-3 text-xs",
        md: "h-9 px-4 py-2 text-sm",
        lg: "h-11 px-6 py-2 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonVariant = "primary" | "secondary" | "destructive" | "success" | "ghost" | "outline" | "link" | "action";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonSharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  bracket?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export interface ButtonAsButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonSharedProps {
  as?: "button";
  ref?: Ref<HTMLButtonElement>;
}

export interface ButtonAsAnchorProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>, ButtonSharedProps {
  as: "a";
  ref?: Ref<HTMLAnchorElement>;
}

export type ButtonProps =
  | ButtonAsButtonProps
  | ButtonAsAnchorProps
  | ButtonRenderPropProps;

export interface ButtonRenderProps<T extends HTMLElement = HTMLElement> {
  ref?: Ref<T>;
  className: string;
  disabled?: boolean;
  "aria-busy"?: boolean;
  "aria-disabled"?: boolean;
  tabIndex?: number;
}

interface ButtonRenderPropProps<T extends HTMLElement = HTMLElement> extends ButtonSharedProps {
  className?: string;
  ref?: Ref<T>;
  as?: undefined;
  children: (props: ButtonRenderProps<T>) => ReactNode;
}

function ButtonContent({
  loading,
  bracket,
  spinnerSize,
  children,
}: {
  loading: boolean;
  bracket: boolean;
  spinnerSize: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const inner = (
    <>
      {loading && <Spinner variant="braille" size={spinnerSize} aria-hidden="true" gap="none" />}
      <span className={loading ? "sr-only" : undefined}>{children}</span>
    </>
  );
  if (bracket) {
    return (
      <>
        <span aria-hidden="true">[</span> {inner} <span aria-hidden="true">]</span>
      </>
    );
  }
  return <>{inner}</>;
}

export function Button(props: ButtonProps) {
  const {
    className,
    variant,
    size,
    bracket,
    loading = false,
    disabled,
    children,
    as: elementType,
    ...rest
  } = props;

  const isDisabled = disabled || loading;
  const resolvedClassName = cn(
    buttonVariants({ variant, size, className }),
    isDisabled && "pointer-events-none opacity-50",
  );

  if (typeof children === "function") {
    const ariaProps = {
      "aria-busy": loading || undefined,
      "aria-disabled": isDisabled || undefined,
      ...(isDisabled && { tabIndex: -1 as const }),
    };
    return children({
      ref: (props as ButtonRenderPropProps).ref,
      className: resolvedClassName,
      disabled: isDisabled || undefined,
      ...ariaProps,
    });
  }

  const spinnerSize: "sm" | "md" | "lg" =
    size === "sm" || size === "md" || size === "lg" ? size : "sm";

  if (elementType === "a") {
    const ariaProps = {
      "aria-busy": loading || undefined,
      "aria-disabled": isDisabled || undefined,
      ...(isDisabled && { tabIndex: -1 as const }),
    };
    const { ref, href, ...anchorProps } = rest as Omit<
      ButtonAsAnchorProps,
      keyof ButtonSharedProps | "children" | "className" | "as"
    >;

    return (
      <a
        className={resolvedClassName}
        ref={ref}
        href={href}
        {...ariaProps}
        {...anchorProps}
        {...(isDisabled && { onClick: (e: ReactMouseEvent) => { e.preventDefault(); } })}
      >
        <ButtonContent loading={loading} bracket={!!bracket} spinnerSize={spinnerSize}>
          {children}
        </ButtonContent>
      </a>
    );
  }

  const { ref, ...buttonProps } = rest as Omit<
    ButtonAsButtonProps,
    keyof ButtonSharedProps | "children" | "className" | "as"
  >;

  return (
    <button
      type="button"
      className={resolvedClassName}
      ref={ref}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      {...buttonProps}
    >
      <ButtonContent loading={loading} bracket={!!bracket} spinnerSize={spinnerSize}>
        {children}
      </ButtonContent>
    </button>
  );
}
