import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface StatusRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function StatusRow({ label, value, className }: StatusRowProps) {
  return (
    <div className={cn('flex justify-between items-center text-xs py-2 border-b border-tui-border/30', className)}>
      <span className="text-tui-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
