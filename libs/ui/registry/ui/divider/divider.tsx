import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Class variants for divider. */
export const dividerVariants = cva("flex opacity-40", {
  variants: {
    variant: {
      default: "",
      spaced: "text-muted-foreground text-xs leading-none select-none",
    },
    orientation: {
      horizontal: "items-center",
      vertical: "flex-col items-center self-stretch",
    },
  },
  compoundVariants: [
    { variant: "spaced", orientation: "horizontal", className: "my-4" },
    { variant: "spaced", orientation: "vertical", className: "mx-4" },
  ],
  defaultVariants: { variant: "default", orientation: "horizontal" },
});

interface DividerBaseProps
  extends ComponentProps<"div">,
    Omit<VariantProps<typeof dividerVariants>, "orientation"> {
  /** Layout axis. Vertical requires the parent to define a height. */
  orientation?: "horizontal" | "vertical";
}

interface DecorativeDividerProps {
  /**
   * Renders with role="none" and aria-hidden. This is the default.
   */
  decorative?: true;
}

interface SemanticDividerProps {
  /** Renders with role="separator" and aria-orientation. */
  decorative: false;
  /** Accessible name for the semantic separator. Visible children do not name a separator. */
  "aria-label": string;
}

/** Props for divider. Semantic separators require an explicit accessible name. */
export type DividerProps = DividerBaseProps & (DecorativeDividerProps | SemanticDividerProps);

/** Line separator with horizontal and vertical orientation, default and spaced variants. */
export function Divider({
  ref,
  className,
  variant,
  orientation = "horizontal",
  decorative = true,
  children,
  ...props
}: DividerProps) {
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is conditionally "separator" (Biome cannot resolve the ternary); aria-orientation is applied only in that branch and is valid for the separator role.
    <div
      ref={ref}
      {...props}
      role={decorative ? "none" : "separator"}
      data-slot="divider"
      aria-hidden={decorative ? true : undefined}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(dividerVariants({ variant, orientation }), className)}
    >
      {variant === "spaced" ? (
        <>
          <span
            className={cn(
              "flex-1 border-border",
              orientation === "horizontal" ? "border-t" : "border-l",
            )}
          />
          <span className={cn("font-light", orientation === "horizontal" ? "px-2" : "py-2")}>
            {children ?? "\u2726"}
          </span>
          <span
            className={cn(
              "flex-1 border-border",
              orientation === "horizontal" ? "border-t" : "border-l",
            )}
          />
        </>
      ) : (
        <span
          className={cn(
            "flex-1 border-border",
            orientation === "horizontal" ? "border-t" : "border-l",
          )}
        />
      )}
    </div>
  );
}
