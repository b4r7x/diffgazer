"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chevronVariants = cva(
  "shrink-0 transition-transform duration-200",
  {
    variants: {
      size: {
        sm: "size-3",
        md: "size-4",
        lg: "size-5",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

type ChevronDirection = "down" | "up" | "left" | "right";

const baseDeg: Record<ChevronDirection, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
};

export interface ChevronProps extends VariantProps<typeof chevronVariants> {
  direction?: ChevronDirection;
  /** When true, rotates 90° clockwise from base direction (expand/collapse toggle). */
  open?: boolean;
  className?: string;
  ref?: React.Ref<SVGSVGElement>;
}

export function Chevron({
  direction = "right",
  open,
  size,
  className,
  ref,
}: ChevronProps) {
  const deg = baseDeg[direction] + (open ? 90 : 0);

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(chevronVariants({ size }), className)}
      style={{ transform: `rotate(${deg}deg)` }}
    >
      <polyline points="6 3 11 8 6 13" />
    </svg>
  );
}
