"use client";

import { Children, type ComponentPropsWithRef, type ReactNode } from "react";
import { useOverflowItems } from "@/hooks/use-overflow-items";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";

export interface OverflowIndicatorRenderProps {
  count: number;
}

export type OverflowIndicatorRender =
  | ((props: OverflowIndicatorRenderProps) => ReactNode)
  | ReactNode;

const hiddenClass = "invisible absolute pointer-events-none";

export interface OverflowItemsProps
  extends Omit<ComponentPropsWithRef<"div">, "children"> {
  children: ReactNode;
  indicator?: OverflowIndicatorRender;
  gap?: string;
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
  ref,
  ...props
}: OverflowItemsProps) {
  const itemCount = Children.count(children);
  const { ref: overflowRef, visibleCount, overflowCount } =
    useOverflowItems({ itemCount });

  return (
    <div
      ref={composeRefs(overflowRef, ref)}
      className={cn("relative flex items-center overflow-clip", gap, className)}
      {...props}
    >
      {Children.map(children, (item, i) => (
        <div className={cn("shrink-0", i >= visibleCount && hiddenClass)} inert={i >= visibleCount || undefined}>
          {item}
        </div>
      ))}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is conditionally "status" (Biome cannot resolve the ternary); aria-label is applied in the same branch and is valid for the status role. */}
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
