import { cn } from '../../../lib/utils';
import type { LensStats } from '@repo/schemas/ui';

export type { LensStats };

export interface LensStatsTableProps {
  lenses: LensStats[];
  className?: string;
}

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return <span className="text-tui-red text-xs">▲ {change}</span>;
  }
  if (change < 0) {
    return <span className="text-tui-green text-xs">▼ {Math.abs(change)}</span>;
  }
  return <span className="text-gray-500 text-xs">─</span>;
}

export function LensStatsTable({ lenses, className }: LensStatsTableProps) {
  return (
    <table className={cn('w-full text-sm text-left border-collapse', className)}>
      <thead>
        <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase">
          <th className="pb-2 font-normal pl-2">Lens</th>
          <th className="pb-2 font-normal text-right">Count</th>
          <th className="pb-2 font-normal text-right pr-2">Change</th>
        </tr>
      </thead>
      <tbody className="text-gray-300">
        {lenses.map((lens, index) => (
          <tr
            key={lens.id}
            className={cn(
              'hover:bg-tui-selection',
              index < lenses.length - 1 && 'border-b border-gray-800/50'
            )}
          >
            <td className="py-3 pl-2 flex items-center gap-2">
              <span className={cn('text-[16px]', lens.iconColor)} aria-hidden="true">
                {lens.icon}
              </span>
              {lens.name}
            </td>
            <td className="py-3 text-right font-bold">{lens.count}</td>
            <td className="py-3 text-right pr-2">
              <ChangeIndicator change={lens.change} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
