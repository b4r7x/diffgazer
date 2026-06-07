"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from "react";
import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";

const LazySpinner = lazy(() => import("../spinner/spinner").then((m) => ({ default: m.Spinner })));

export const buttonVariants = cva(
  "inline-flex items-center justify-center font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
        secondary: "border border-border bg-transparent text-foreground hover:bg-secondary",
        destructive:
          "text-error-fg border border-error-border bg-transparent hover:bg-error-strong hover:text-error-strong-foreground",
        success:
          "bg-success-strong text-success-strong-foreground font-bold hover:bg-success-strong/90",
        ghost: "bg-transparent text-foreground hover:bg-secondary",
        outline: "border border-border bg-transparent text-foreground hover:bg-border",
        link: "bg-transparent text-info-fg underline-offset-2 hover:underline",
        action: "bg-action text-action-foreground font-bold hover:bg-action/90",
      },
      size: {
        sm: "h-7 px-3 text-xs",
        md: "h-9 px-4 py-2 text-sm",
        lg: "h-11 px-6 py-2 text-base",
        icon: "h-9 w-9 p-0",
      },
      highlighted: {
        true: "ring-2 ring-primary ring-offset-2 ring-offset-background",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;
type ButtonVariant = ButtonVariantProps["variant"];
type ButtonSize = ButtonVariantProps["size"];

interface ButtonSharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  bracket?: boolean;
  loading?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
}

export interface ButtonAsButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonSharedProps {
  as?: "button";
  ref?: Ref<HTMLButtonElement>;
}

export interface ButtonAsAnchorProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>,
    ButtonSharedProps {
  as: "a";
  ref?: Ref<HTMLAnchorElement>;
}

export type ButtonProps = ButtonAsButtonProps | ButtonAsAnchorProps | ButtonRenderPropProps;

export interface ButtonRenderProps<T extends HTMLElement = HTMLElement> {
  ref?: Ref<T>;
  className: string;
  disabled?: boolean;
  "aria-busy"?: boolean;
  "aria-disabled"?: boolean;
  "data-loading"?: boolean;
  tabIndex?: number;
}

interface ButtonRenderPropProps<T extends HTMLElement = HTMLElement> extends ButtonSharedProps {
  className?: string;
  ref?: Ref<T>;
  as?: undefined;
  children: (props: ButtonRenderProps<T>) => ReactNode;
}

function isRenderPropProps(props: ButtonProps): props is ButtonRenderPropProps {
  return typeof props.children === "function";
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
      {loading && (
        <Suspense fallback={null}>
          <LazySpinner variant="braille" size={spinnerSize} aria-hidden="true" gap="none" />
        </Suspense>
      )}
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

export function Button(props: ButtonProps): ReactNode {
  const {
    className,
    variant,
    size,
    bracket,
    loading = false,
    disabled,
    highlighted,
    children,
    as: elementType,
    ...rest
  } = props;

  const isDisabled = disabled || loading;
  const resolvedClassName = cn(
    buttonVariants({ variant, size, highlighted: highlighted || undefined }),
    className,
  );

  if (isRenderPropProps(props)) {
    const ariaProps = {
      "aria-busy": loading || undefined,
      "aria-disabled": isDisabled || undefined,
      "data-loading": loading || undefined,
      ...(isDisabled && { tabIndex: -1 as const }),
    };
    return props.children({
      ref: props.ref,
      className: resolvedClassName,
      disabled: isDisabled || undefined,
      ...ariaProps,
    });
  }

  // The render-function form is handled above, so props is narrowed and children is element content here.
  const content = props.children;

  const spinnerSize: "sm" | "md" | "lg" =
    size === "sm" || size === "md" || size === "lg" ? size : "sm";

  if (elementType === "a") {
    const ariaProps = {
      "aria-busy": loading || undefined,
      "aria-disabled": isDisabled || undefined,
      "data-loading": loading || undefined,
      ...(isDisabled && { tabIndex: -1 as const }),
    };
    const {
      ref,
      href,
      onClick,
      role: consumerRole,
      ...anchorProps
    } = rest as Omit<
      ButtonAsAnchorProps,
      keyof ButtonSharedProps | "children" | "className" | "as"
    >;

    return (
      <a
        className={resolvedClassName}
        ref={ref}
        href={isDisabled ? undefined : href}
        {...anchorProps}
        {...ariaProps}
        role={isDisabled ? "link" : consumerRole}
        onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
          if (isDisabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
      >
        <ButtonContent loading={loading} bracket={!!bracket} spinnerSize={spinnerSize}>
          {content}
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
      data-loading={loading || undefined}
      disabled={isDisabled}
      {...buttonProps}
    >
      <ButtonContent loading={loading} bracket={!!bracket} spinnerSize={spinnerSize}>
        {content}
      </ButtonContent>
    </button>
  );
}
