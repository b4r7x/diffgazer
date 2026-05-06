import type { HTMLAttributes, Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

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

export interface DividerProps
  extends HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof dividerVariants>, "orientation"> {
  ref?: Ref<HTMLDivElement>;
  /** When true (default), screen readers skip this separator. Set to false for meaningful content boundaries. */
  decorative?: boolean;
  orientation?: "horizontal" | "vertical";
}

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
    <div
      ref={ref}
      {...props}
      role={decorative ? "none" : "separator"}
      aria-hidden={decorative ? true : undefined}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(dividerVariants({ variant, orientation }), className)}
    >
      {variant === "spaced" ? (
        <>
          <span className={cn("flex-1 border-border", orientation === "horizontal" ? "border-t" : "border-l")} />
          <span className={cn("font-light", orientation === "horizontal" ? "px-2" : "py-2")}>
            {children ?? "\u2726"}
          </span>
          <span className={cn("flex-1 border-border", orientation === "horizontal" ? "border-t" : "border-l")} />
        </>
      ) : (
        <span className={cn("flex-1 border-border", orientation === "horizontal" ? "border-t" : "border-l")} />
      )}
    </div>
  );
}
