import { cn } from '../../lib/utils';

export type StatusVariant = 'active' | 'idle' | 'error' | 'warning';

export interface StatusBadgeProps {
  status: StatusVariant;
  label: string;
  showGlow?: boolean;
  size?: 'sm' | 'md';
}

const statusColors: Record<StatusVariant, string> = {
  active: 'bg-[--tui-green]',
  idle: 'bg-[--tui-muted]',
  error: 'bg-[--tui-red]',
  warning: 'bg-[--tui-yellow]',
};

const glowColors: Record<StatusVariant, string> = {
  active: 'shadow-[0_0_8px_var(--tui-green)]',
  idle: '',
  error: 'shadow-[0_0_8px_var(--tui-red)]',
  warning: 'shadow-[0_0_8px_var(--tui-yellow)]',
};

export function StatusBadge({ status, label, showGlow = false, size = 'md' }: StatusBadgeProps) {
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <div className="inline-flex items-center gap-2 font-mono">
      <span
        className={cn(
          'rounded-full',
          dotSize,
          statusColors[status],
          showGlow && glowColors[status]
        )}
      />
      <span className={cn('text-[--tui-fg]', size === 'sm' && 'text-xs')}>{label}</span>
    </div>
  );
}
