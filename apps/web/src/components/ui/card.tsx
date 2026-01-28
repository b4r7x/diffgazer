import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export interface CardSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

function CardSection({ title, children, className }: CardSectionProps) {
  return (
    <div className={cn('relative', title && 'mt-4 pt-2 border-t border-[--tui-border]', className)}>
      {title && (
        <span className="absolute -top-2.5 left-2 px-1 bg-[--tui-bg] text-[--tui-fg]/60 text-xs font-mono">
          {title}
        </span>
      )}
      {children}
    </div>
  );
}

function CardRoot({ title, badge, children, className }: CardProps) {
  return (
    <div
      className={cn(
        'relative border border-[--tui-border] bg-[--tui-bg] text-[--tui-fg] font-mono',
        'pt-4 pb-3 px-4',
        className
      )}
    >
      <div className="absolute -top-2.5 left-0 right-0 flex items-center px-2">
        <span className="flex items-center gap-2 px-1 bg-[--tui-bg] text-sm font-bold">
          <span>{title}</span>
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}

export const Card = CardRoot;
export { CardSection };
