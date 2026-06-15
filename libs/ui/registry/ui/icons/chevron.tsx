import { cva, type VariantProps } from "class-variance-authority";
import type { CSSProperties, Ref, SVGProps } from "react";
import { cn } from "@/lib/utils";

/** Class variants for chevron. */
export const chevronVariants = cva(
  "shrink-0 motion-safe:transition-transform motion-safe:duration-200",
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
  },
);

type ChevronDirection = "down" | "up" | "left" | "right";

const baseDeg: Record<ChevronDirection, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
};

/** Props for chevron. */
export interface ChevronProps
  extends Omit<SVGProps<SVGSVGElement>, "ref">,
    VariantProps<typeof chevronVariants> {
  /** Base direction the chevron points before any rotation. */
  direction?: ChevronDirection;
  /** Rotates 90 degrees clockwise from the base direction. Use for expand/collapse toggles. */
  open?: boolean;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<SVGSVGElement>;
}

/** Directional SVG icon with rotation animation and size variants. */
export function Chevron({
  direction = "right",
  open,
  size,
  className,
  ref,
  style,
  "aria-hidden": ariaHidden,
  ...props
}: ChevronProps) {
  const deg = baseDeg[direction] + (open ? 90 : 0);
  const transformStyle: CSSProperties = { ...style, transform: `rotate(${deg}deg)` };

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative chevron icon defaulting to aria-hidden; Biome cannot resolve the dynamic aria-hidden default, and consumers add a label when the icon is meaningful.
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden ?? true}
      className={cn(chevronVariants({ size }), className)}
      style={transformStyle}
      {...props}
    >
      <polyline points="6 3 11 8 6 13" />
    </svg>
  );
}
