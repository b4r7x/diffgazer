import type { CategoryStats } from "@diffgazer/core/schemas/presentation";
import { cn } from "@diffgazer/ui/lib/utils";

export type CategoryStatsTableProps = {
  categories: CategoryStats[];
  className?: string;
};

export function CategoryStatsTable({ categories, className }: CategoryStatsTableProps) {
  return (
    <table className={cn("w-full text-sm text-left border-collapse", className)}>
      <thead>
        <tr className="text-muted-foreground border-b border-border text-xs uppercase">
          <th className="pb-2 font-normal">Category</th>
          <th className="pb-2 font-normal text-right">Count</th>
        </tr>
      </thead>
      <tbody className="text-foreground/80">
        {categories.map((category, index) => (
          <tr
            key={category.id}
            className={cn(
              "hover:bg-secondary",
              index < categories.length - 1 && "border-b border-border/50",
            )}
          >
            {/* Category names stay neutral on purpose: hue is the severity vocabulary
                on this screen, and tinting categories made the same colors mean two
                different things side by side. */}
            <td className="py-3">{category.name}</td>
            <td className="py-3 text-right font-bold">{category.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
