'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center font-bold tracking-wider rounded-sm border shrink-0 whitespace-nowrap',
  {
    variants: {
      variant: {
        success: 'bg-tui-green/10 text-tui-green border-tui-green',
        warning: 'bg-tui-yellow/10 text-tui-yellow border-tui-yellow',
        error: 'bg-tui-red/10 text-tui-red border-tui-red',
        info: 'bg-tui-blue/10 text-tui-blue border-tui-blue',
        neutral: 'bg-tui-muted/10 text-tui-muted border-tui-border',
        stored: 'bg-transparent text-tui-green border-transparent',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'sm' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({
  className,
  variant,
  size,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </span>
  );
}
