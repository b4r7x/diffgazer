import { cn } from '../../lib/utils';

export interface CapabilityCardProps {
  label: string;
  value: string;
  className?: string;
}

export function CapabilityCard({ label, value, className }: CapabilityCardProps) {
  return (
    <div className={cn('p-3 border border-tui-border bg-tui-selection/20', className)}>
      <div className="text-[10px] text-gray-500 mb-1 italic">{label}</div>
      <div className="text-xs text-tui-fg">{value}</div>
    </div>
  );
}
