import { cn } from '@/utils/cn';
import type { LensStats } from '@stargazer/schemas/ui';

export type { LensStats };

export interface LensStatsTableProps {
  lenses: LensStats[];
  className?: string;
}

export function LensStatsTable({ lenses, className }: LensStatsTableProps) {
  return (
    <table className={cn('w-full text-sm text-left border-collapse', className)}>
      <thead>
        <tr className="text-tui-muted border-b border-tui-border text-xs uppercase">
          <th className="pb-2 font-normal pl-2">Lens</th>
          <th className="pb-2 font-normal text-right pr-2">Count</th>
        </tr>
      </thead>
      <tbody className="text-tui-fg/80">
        {lenses.map((lens, index) => (
          <tr
            key={lens.id}
            className={cn(
              'hover:bg-tui-selection',
              index < lenses.length - 1 && 'border-b border-tui-border/50'
            )}
          >
            <td className="py-3 pl-2 flex items-center gap-2">
              <span className={cn('text-[16px]', lens.iconColor)} aria-hidden="true">
                {lens.icon}
              </span>
              {lens.name}
            </td>
            <td className="py-3 text-right font-bold pr-2">{lens.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
