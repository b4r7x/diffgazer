import { cn } from '../../lib/utils';

export interface MetricItemProps {
  label: string;
  value: React.ReactNode;
  variant?: 'default' | 'warning' | 'info';
  className?: string;
}

const valueVariants = {
  default: 'font-bold text-tui-fg',
  warning: 'font-bold text-tui-yellow',
  info: 'font-mono text-tui-blue',
};

export function MetricItem({ label, value, variant = 'default', className }: MetricItemProps) {
  return (
    <div className={cn('flex justify-between items-center', className)}>
      <span className="text-sm text-gray-400">{label}</span>
      <span className={valueVariants[variant]}>{value}</span>
    </div>
  );
}
