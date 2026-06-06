import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export const emptyStateVariants = cva("group/es text-muted-foreground", {
  variants: {
    variant: {
      centered: "flex flex-col items-center justify-center text-center",
      inline: "flex items-start",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
    },
  },
  compoundVariants: [
    { variant: "centered", size: "sm", class: "gap-2 p-3" },
    { variant: "centered", size: "md", class: "gap-3 p-6" },
    { variant: "centered", size: "lg", class: "gap-4 p-10" },
    { variant: "inline", size: "sm", class: "gap-2 p-2" },
    { variant: "inline", size: "md", class: "gap-3 p-4" },
    { variant: "inline", size: "lg", class: "gap-4 p-6" },
  ],
  defaultVariants: { variant: "centered", size: "md" },
});

export type EmptyStateSize = NonNullable<VariantProps<typeof emptyStateVariants>["size"]>;
export type EmptyStateVariant = NonNullable<VariantProps<typeof emptyStateVariants>["variant"]>;

export type EmptyStateProps = ComponentPropsWithRef<"div"> & {
  variant?: EmptyStateVariant;
  size?: EmptyStateSize;
  live?: boolean;
};

export function EmptyState({ variant = "centered", size = "md", live = false, className, children, ...props }: EmptyStateProps) {
  return (
    <div
      data-size={size}
      {...(live ? { role: "status" as const, "aria-live": "polite" as const } : undefined)}
      className={cn(emptyStateVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </div>
  );
}
