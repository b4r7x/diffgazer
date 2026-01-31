'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { formatTimestamp } from '@repo/core';
import { cn } from '../../../lib/utils';
import type { LogTagType } from '@repo/schemas/ui';

export type { LogTagType };

const tagVariants = cva('font-bold', {
  variants: {
    tagType: {
      system: 'text-tui-violet',
      tool: 'text-tui-blue',
      lens: 'text-tui-violet',
      warning: 'text-tui-yellow',
      error: 'text-tui-red',
      agent: 'text-tui-green',
      thinking: 'text-tui-cyan',
    },
  },
  defaultVariants: { tagType: 'system' },
});

export interface LogEntryProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof tagVariants> {
  timestamp: Date | string;
  tag: string;
  message: React.ReactNode;
  isWarning?: boolean;
  isMuted?: boolean;
}

export function LogEntry({
  timestamp,
  tag,
  tagType,
  message,
  isWarning,
  isMuted,
  className,
  ...props
}: LogEntryProps) {
  return (
    <div
      className={cn('font-mono text-sm', isMuted && 'opacity-50', className)}
      {...props}
    >
      <span className="text-gray-600">[{formatTimestamp(timestamp)}]</span>{' '}
      <span className={tagVariants({ tagType })}>[{tag}]</span>
      <span className="text-gray-600"> → </span>
      <span className={cn('text-gray-400', isWarning && 'text-tui-yellow')}>
        {isWarning && '⚠ '}
        {message}
      </span>
    </div>
  );
}
