import { cn } from '../../lib/utils';

export type InfoFieldColor = 'blue' | 'violet' | 'green' | 'yellow' | 'red' | 'muted';

export interface InfoFieldProps {
  label: string;
  color?: InfoFieldColor;
  children: React.ReactNode;
  className?: string;
}

const labelColors: Record<InfoFieldColor, string> = {
  blue: 'text-tui-blue',
  violet: 'text-tui-violet',
  green: 'text-tui-green',
  yellow: 'text-tui-yellow',
  red: 'text-tui-red',
  muted: 'text-gray-400',
};

export function InfoField({ label, color = 'muted', children, className }: InfoFieldProps) {
  return (
    <div className={cn(className)}>
      <div className={cn('text-xs uppercase mb-1 font-bold', labelColors[color])}>
        {label}
      </div>
      <div className="text-tui-fg opacity-90">
        {children}
      </div>
    </div>
  );
}
