import type { ComponentProps, CSSProperties } from "react";

/** Props for skeleton. */
export type SkeletonProps = Omit<ComponentProps<"div">, "aria-hidden"> & {
  /**
   * Width of the placeholder in character cells, so it reserves the width of the
   * value it stands in for. Surfaces as data-chars plus the --skeleton-chars
   * custom property; omit and set width via className instead.
   */
  chars?: number;
};

/** Decorative character-cell placeholder. Use chars or className to set width and height. */
export function Skeleton({ chars, className, ref, style, ...props }: SkeletonProps) {
  return (
    <div
      ref={ref}
      data-slot="skeleton"
      data-chars={chars === undefined ? undefined : String(chars)}
      className={className}
      style={
        chars === undefined ? style : ({ ...style, "--skeleton-chars": chars } as CSSProperties)
      }
      {...props}
      aria-hidden="true"
    />
  );
}
