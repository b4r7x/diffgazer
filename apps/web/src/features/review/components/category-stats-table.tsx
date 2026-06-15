import type { CategoryStats } from "@diffgazer/core/schemas/presentation";
import { cn } from "@diffgazer/ui/lib/utils";

export type { CategoryStats };

export interface CategoryStatsTableProps {
  categories: CategoryStats[];
  className?: string;
}

export function CategoryStatsTable({ categories, className }: CategoryStatsTableProps) {
  return (
    <table className={cn("w-full text-sm text-left border-collapse", className)}>
      <thead>
        <tr className="text-muted-foreground border-b border-border text-xs uppercase">
          <th className="pb-2 font-normal pl-2">Category</th>
          <th className="pb-2 font-normal text-right pr-2">Count</th>
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
            <td className="py-3 pl-2 flex items-center gap-2">
              <span className={cn("text-base", category.iconColor)} aria-hidden="true">
                {category.icon}
              </span>
              {category.name}
            </td>
            <td className="py-3 text-right font-bold pr-2">{category.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
