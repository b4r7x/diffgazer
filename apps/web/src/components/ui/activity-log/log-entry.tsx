'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { formatTimestamp } from '@stargazer/core';
import { cn } from '../../../lib/utils';
import type { LogTagType } from '@stargazer/schemas/ui';

export type { LogTagType };

const tagVariants = cva('font-bold', {
  variants: {
    tagType: {
      system: 'text-tui-violet',
      tool: 'text-tui-blue',
      lens: 'text-tui-violet',
      warning: 'text-tui-yellow',
      error: 'text-tui-red',
      agent: 'text-tui-violet',
      thinking: 'text-gray-500',
    },
  },
  defaultVariants: { tagType: 'system' },
});

export interface LogEntryProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof tagVariants> {
  timestamp: Date | string;
  tag: string;
  source?: string;
  message: React.ReactNode;
  isWarning?: boolean;
  isError?: boolean;
  isMuted?: boolean;
}

export function LogEntry({
  timestamp,
  tag,
  tagType,
  source,
  message,
  isWarning,
  isError,
  isMuted,
  className,
}: LogEntryProps) {
  return (
    <div className={cn('font-mono text-sm leading-relaxed', isMuted && 'opacity-50', className)}>
      <span className="text-gray-600">[{formatTimestamp(timestamp)}]</span>{' '}
      <span className={tagVariants({ tagType })}>[{tag}]</span>{' '}
      {source && (
        <>
          <span className="font-bold text-tui-fg">{source}</span>
          <span className="text-gray-600"> → </span>
        </>
      )}
      <span className={cn('text-gray-400', isWarning && 'text-tui-yellow', isError && 'text-tui-red')}>
        {message}
      </span>
    </div>
  );
}
