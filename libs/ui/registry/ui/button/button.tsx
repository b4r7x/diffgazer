"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEventHandler,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from "react";
import { lazy, Suspense } from "react";
import { FOCUS_OUTLINE, HIGHLIGHT_OUTLINE } from "@/lib/focus-outline";
import { cn } from "@/lib/utils";

const LazySpinner = lazy(() => import("../spinner/spinner").then((m) => ({ default: m.Spinner })));

export const buttonVariants = cva(
  `inline-flex items-center justify-center wrap-break-word text-center font-mono transition-colors ${FOCUS_OUTLINE} cursor-pointer disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40`,
  {
    variants: {
      // One filled voice (primary, on the --action pair) so a screen never
      // argues about which button is the call to action. Semantic intents
      // (success, destructive) are outlined: colour carries meaning, fill
      // carries priority, so intent never competes with the single CTA.
      variant: {
        // Disabled primary drops the fill instead of fading it: opacity over a
        // coloured fill drags the label toward the page with it and the pair
        // collapses (~1.8:1 on light --action). Emptying the fill leaves the
        // muted label on the ambient surface, where it keeps its own contrast,
        // and a half-strength solid --border edge keeps the button's shape
        // readable — no control in the system draws a dashed or dotted edge.
        // The transparent border reserves that edge so toggling disabled never
        // resizes the button.
        primary:
          "border border-transparent bg-action text-action-foreground font-bold hover:bg-action/90 disabled:border-border/50 disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100 aria-disabled:border-border/50 aria-disabled:bg-transparent aria-disabled:text-muted-foreground aria-disabled:opacity-100",
        secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-border",
        destructive:
          "text-error-text border border-error-border bg-transparent hover:bg-error-strong hover:text-error-strong-foreground",
        success:
          "text-success-text border border-success-border bg-transparent hover:bg-success-strong hover:text-success-strong-foreground",
        ghost: "bg-transparent text-foreground hover:bg-secondary",
        outline: "border border-border bg-transparent text-foreground hover:bg-secondary",
        link: "bg-transparent text-info-text underline-offset-2 hover:underline",
      },
      // Sizes are pointer:fine densities. On pointer:coarse, sm/md/icon extend a
      // transparent pseudo-element hit area to a 44px effective target without
      // changing the visual box (buttons live in fixed-height toolbars and panel
      // headers). `relative` rides along with each of those sizes so the size
      // itself is the pseudo-element's containing block; lg is already 44px and
      // stays position:static.
      //
      // Two preconditions the call site owns, because the button cannot see them:
      // 1. Room for the overhang inside the nearest `overflow-hidden` ancestor.
      //    One is nearly always present (app shells and panel frames are clipped
      //    boxes); what matters is the gap — a button sitting closer to that clip
      //    edge than the overhang reaches loses it, and the target silently
      //    shrinks back to the visual box.
      // 2. A minimum vertical gap to the next interactive row: 16px for sm,
      //    8px for md and icon. Below that the extended areas overlap and taps
      //    land on the wrong control. Horizontal neighbours are safe: the
      //    extension is vertical only (`inset-x-0`), except icon, which also
      //    widens by 4px per side to reach 44px across.
      size: {
        sm: "relative min-h-7 h-auto max-w-full whitespace-normal px-3 py-1 text-xs pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-2 pointer-coarse:before:content-['']",
        md: "relative min-h-9 h-auto max-w-full whitespace-normal px-4 py-2 text-sm pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-1 pointer-coarse:before:content-['']",
        lg: "min-h-11 h-auto max-w-full whitespace-normal px-6 py-2 text-base",
        icon: "relative h-9 w-9 max-w-none shrink-0 whitespace-nowrap p-0 pointer-coarse:before:absolute pointer-coarse:before:-inset-x-1 pointer-coarse:before:-inset-y-1 pointer-coarse:before:content-['']",
      },
      // Virtual focus from a parent collection wears the same outside ring as
      // real focus (one focus grammar, one token), just without focus-visible.
      highlighted: {
        true: HIGHLIGHT_OUTLINE,
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

export type ButtonProps<T extends HTMLElement = HTMLElement> =
  | ButtonAsButtonProps
  | ButtonAsAnchorProps
  | ButtonRenderPropProps<T>;

export interface ButtonRenderProps<T extends HTMLElement = HTMLElement> {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<T>;
  /** Additional class names merged onto the rendered element. */
  className: string;
  /** Disables interaction; sets aria-disabled and stops onClick. */
  disabled?: boolean;
  /** Prevents activation while disabled or loading. */
  onClick: MouseEventHandler<T>;
  /** ARIA busy state forwarded to the rendered element. */
  "aria-busy"?: boolean;
  /** ARIA disabled state forwarded to the rendered element. */
  "aria-disabled"?: boolean;
  /** Stable slot marker for styling and tests. */
  "data-slot"?: "button";
  /** Present when the component is in a loading state. */
  "data-loading"?: boolean;
  /** Present when the component is highlighted by a parent collection. */
  "data-highlighted"?: string;
  /** Tab index applied to the rendered element. */
  tabIndex?: number;
}

export interface ButtonRenderPropProps<T extends HTMLElement = HTMLElement>
  extends ButtonSharedProps {
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

function isRenderPropProps<T extends HTMLElement>(
  props: ButtonProps<T>,
): props is ButtonRenderPropProps<T> {
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
        // The label goes sr-only while loading, so the fallback has to hold the
        // spinner's box or the button renders empty until the chunk resolves.
        <Suspense fallback={<span aria-hidden="true" className="inline-flex size-[2em]" />}>
          <LazySpinner variant="braille" size={spinnerSize} aria-hidden="true" gap="none" />
        </Suspense>
      )}
      <span className={loading ? "sr-only" : "min-w-0"}>{children}</span>
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
export function Button<T extends HTMLElement = HTMLElement>(props: ButtonProps<T>): ReactNode {
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
      "data-highlighted": highlighted ? "" : undefined,
      ...(isDisabled && { tabIndex: -1 as const }),
    };
    return props.children({
      ref: props.ref,
      className: resolvedClassName,
      disabled: isDisabled || undefined,
      onClick: (event: ReactMouseEvent<T>) => {
        if (isDisabled) event.preventDefault();
      },
      ...ariaProps,
    });
  }

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
        data-highlighted={highlighted ? "" : undefined}
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
      data-highlighted={highlighted ? "" : undefined}
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
