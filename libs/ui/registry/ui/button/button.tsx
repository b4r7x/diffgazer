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

/** Class variants for button. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center font-mono whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 cursor-pointer disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
        secondary: "border border-border bg-transparent text-foreground hover:bg-secondary",
        destructive:
          "text-error-text border border-error-border bg-transparent hover:bg-error-strong hover:text-error-strong-foreground",
        success:
          "bg-success-strong text-success-strong-foreground font-bold hover:bg-success-strong/90",
        ghost: "bg-transparent text-foreground hover:bg-secondary",
        outline: "border border-border bg-transparent text-foreground hover:bg-border",
        link: "bg-transparent text-info-text underline-offset-2 hover:underline",
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

/** Props for button variant. */
type ButtonVariantProps = VariantProps<typeof buttonVariants>;
/** Allowed button variant values. */
type ButtonVariant = ButtonVariantProps["variant"];
/** Allowed button size values. */
type ButtonSize = ButtonVariantProps["size"];

/** Shared visual and interaction props for every Button rendering mode. */
interface ButtonSharedProps {
  /** Visual style of the button. */
  variant?: ButtonVariant;
  /** Size token applied to height, padding, and font size. */
  size?: ButtonSize;
  /**
   * Wraps the button label in [ ] characters for terminal-style emphasis. Switches to [ ... ]
   * when loading is true.
   */
  bracket?: boolean;
  /** Shows a Spinner in place of the label and disables click activation. */
  loading?: boolean;
  /** Disables interaction; sets aria-disabled and stops onClick. */
  disabled?: boolean;
  /**
   * Marks the button as currently highlighted by a parent collection (data-highlighted
   * attribute).
   */
  highlighted?: boolean;
}

/** Props for button as button. */
export interface ButtonAsButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonSharedProps {
  /**
   * Render as a native <button> or as an <a> for navigation. The "link" variant is purely
   * visual; combine it with as="a" for a semantic link.
   */
  as?: "button";
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLButtonElement>;
}

/** Props for button as anchor. */
export interface ButtonAsAnchorProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>,
    ButtonSharedProps {
  /**
   * Render as a native <button> or as an <a> for navigation. The "link" variant is purely
   * visual; combine it with as="a" for a semantic link.
   */
  as: "a";
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLAnchorElement>;
}

/** Props for button. */
export type ButtonProps = ButtonAsButtonProps | ButtonAsAnchorProps | ButtonRenderPropProps;

/** Props for button render. */
export interface ButtonRenderProps<T extends HTMLElement = HTMLElement> {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<T>;
  /** Additional class names merged onto the rendered element. */
  className: string;
  /** Disables interaction; sets aria-disabled and stops onClick. */
  disabled?: boolean;
  /** ARIA busy state forwarded to the rendered element. */
  "aria-busy"?: boolean;
  /** ARIA disabled state forwarded to the rendered element. */
  "aria-disabled"?: boolean;
  /** Stable slot marker for styling and tests. */
  "data-slot"?: "button";
  /** Present when the component is in a loading state. */
  "data-loading"?: boolean;
  /** Tab index applied to the rendered element. */
  tabIndex?: number;
}

/** Props for button render prop. */
interface ButtonRenderPropProps<T extends HTMLElement = HTMLElement> extends ButtonSharedProps {
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<T>;
  /**
   * Render as a native <button> or as an <a> for navigation. The "link" variant is purely
   * visual; combine it with as="a" for a semantic link.
   */
  as?: undefined;
  /**
   * Button label, or a render function that receives computed props (className, disabled, ARIA
   * attributes) for full polymorphism.
   */
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

/** Root button element. */
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
      "data-slot": "button" as const,
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
    const {
      ref,
      href,
      onClick,
      role: consumerRole,
      "aria-busy": consumerAriaBusy,
      "aria-disabled": consumerAriaDisabled,
      tabIndex: consumerTabIndex,
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
        data-slot="button"
        data-loading={loading || undefined}
        {...anchorProps}
        aria-busy={consumerAriaBusy ?? (loading || undefined)}
        aria-disabled={consumerAriaDisabled ?? (isDisabled || undefined)}
        // Disabled forces the link out of the tab order (safety invariant);
        // otherwise the consumer tabIndex stands.
        tabIndex={isDisabled ? -1 : consumerTabIndex}
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

  const {
    ref,
    onClick,
    "aria-busy": consumerAriaBusy,
    "aria-disabled": consumerAriaDisabled,
    ...buttonProps
  } = rest as Omit<ButtonAsButtonProps, keyof ButtonSharedProps | "children" | "className" | "as">;

  // Loading is a transient busy state, not a consumer disable: keep the button
  // focusable (aria-disabled + click suppression) so focus does not fall to
  // <body> mid-interaction. A consumer-set `disabled` still renders native disabled.
  const loadingOnly = loading && !disabled;

  return (
    <button
      type="button"
      className={resolvedClassName}
      ref={ref}
      data-slot="button"
      data-loading={loading || undefined}
      disabled={disabled || undefined}
      {...buttonProps}
      aria-busy={consumerAriaBusy ?? (loading || undefined)}
      aria-disabled={consumerAriaDisabled ?? (loadingOnly || undefined)}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
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
    </button>
  );
}
