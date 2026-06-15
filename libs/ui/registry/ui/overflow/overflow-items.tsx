"use client";

import { Children, type ComponentPropsWithRef, type ReactNode } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useOverflowItems } from "@/hooks/use-overflow-items";
import { cn } from "@/lib/utils";

/** Props for overflow indicator render. */
export interface OverflowIndicatorRenderProps {
  /** Numeric count rendered by the component. */
  count: number;
}

/** Root - text mode by default; set mode="items" for fitting child items. */
export type OverflowIndicatorRender =
  | ((props: OverflowIndicatorRenderProps) => ReactNode)
  | ReactNode;

const hiddenClass = "invisible absolute pointer-events-none";

/** Props for overflow items. */
export interface OverflowItemsProps extends Omit<ComponentPropsWithRef<"div">, "children"> {
  /** String to clamp (text mode) or items to measure (items mode). */
  children: ReactNode;
  /** Items mode only. Render function or static node shown when items overflow. */
  indicator?: OverflowIndicatorRender;
  /** Items mode only. Tailwind gap class applied between items and indicator. */
  gap?: string;
  /** Accessible name for the overflow indicator. Defaults to `${count} more items`. */
  getOverflowLabel?: (count: number) => string;
}

function DefaultBadge() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center border border-dashed border-foreground/30 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
    >
      …
    </span>
  );
}

function IndicatorDisplay({
  indicator,
  count,
}: {
  indicator?: OverflowIndicatorRender;
  count: number;
}) {
  if (typeof indicator === "function") {
    return <>{indicator({ count })}</>;
  }
  return <>{indicator ?? <DefaultBadge />}</>;
}

/** Root - text mode by default; set mode="items" for fitting child items. */
export function OverflowItems({
  children,
  indicator,
  gap = "gap-1",
  className,
  getOverflowLabel,
  ref,
  ...props
}: OverflowItemsProps) {
  const itemCount = Children.count(children);
  const { ref: overflowRef, visibleCount, overflowCount } = useOverflowItems({ itemCount });
  const composedRef = useComposedRefs(overflowRef, ref);

  return (
    <div
      ref={composedRef}
      className={cn("relative flex items-center overflow-clip", gap, className)}
      {...props}
    >
      {Children.map(children, (item, i) => (
        <div
          className={cn("shrink-0", i >= visibleCount && hiddenClass)}
          inert={i >= visibleCount || undefined}
        >
          {item}
        </div>
      ))}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is conditionally "status" (Biome cannot resolve the ternary); aria-label is applied in the same branch and is valid for the status role. */}
      <div
        className={cn("shrink-0", overflowCount === 0 && hiddenClass)}
        role={overflowCount > 0 ? "status" : undefined}
        aria-label={
          overflowCount > 0
            ? (getOverflowLabel?.(overflowCount) ?? `${overflowCount} more items`)
            : undefined
        }
        inert={overflowCount === 0 || undefined}
      >
        <IndicatorDisplay indicator={indicator} count={overflowCount} />
      </div>
    </div>
  );
}
