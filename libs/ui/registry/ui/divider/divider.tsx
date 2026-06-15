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

/** Props for divider. */
export interface DividerProps
  extends ComponentProps<"div">,
    Omit<VariantProps<typeof dividerVariants>, "orientation"> {
  /**
   * Renders with role="none" and aria-hidden when true. Set to false for meaningful section
   * boundaries; renders role="separator" with aria-orientation.
   */
  decorative?: boolean;
  /** Layout axis. Vertical requires the parent to define a height. */
  orientation?: "horizontal" | "vertical";
}

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
