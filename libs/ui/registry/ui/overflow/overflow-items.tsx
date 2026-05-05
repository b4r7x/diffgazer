"use client";

import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOverflowItems } from "@/hooks/use-overflow-items";

export interface OverflowIndicatorRenderProps {
  count: number;
}

export type OverflowIndicatorRender =
  | ((props: OverflowIndicatorRenderProps) => ReactNode)
  | ReactNode;

const hiddenClass = "invisible absolute pointer-events-none";

export interface OverflowItemsProps {
  children: ReactNode;
  indicator?: OverflowIndicatorRender;
  gap?: string;
  className?: string;
}

function DefaultBadge() {
  return (
    <span aria-hidden="true" className="inline-flex items-center border border-dashed border-foreground/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      …
    </span>
  );
}

function IndicatorDisplay({ indicator, count }: { indicator?: OverflowIndicatorRender; count: number }) {
  if (typeof indicator === "function") {
    return <>{indicator({ count })}</>;
  }
  return <>{indicator ?? <DefaultBadge />}</>;
}

export function OverflowItems({
  children,
  indicator,
  gap = "gap-1",
  className,
}: OverflowItemsProps) {
  const items = Children.toArray(children);
  const { ref, visibleCount, overflowCount } =
    useOverflowItems({ itemCount: items.length });

  return (
    <div
      ref={ref}
      className={cn("relative flex items-center overflow-clip", gap, className)}
    >
      {items.map((item, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className={cn("shrink-0", i >= visibleCount && hiddenClass)} inert={i >= visibleCount || undefined}>
          {item}
        </div>
      ))}
      <div
        className={cn("shrink-0", overflowCount === 0 && hiddenClass)}
        role={overflowCount > 0 ? "status" : undefined}
        aria-label={overflowCount > 0 ? `${overflowCount} more items` : undefined}
        inert={overflowCount === 0 || undefined}
      >
        <IndicatorDisplay indicator={indicator} count={overflowCount} />
      </div>
    </div>
  );
}
