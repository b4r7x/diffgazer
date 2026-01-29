'use client';

import { cn } from '../../lib/utils';

export interface KeyboardHintProps {
  keys: string | string[];
  description: string;
  className?: string;
}

export function KeyboardHint({ keys, description, className }: KeyboardHintProps) {
  const keyList = Array.isArray(keys) ? keys : [keys];

  return (
    <span className={cn('flex items-center gap-1', className)}>
      {keyList.map((key, index) => (
        <span key={key}>
          {index > 0 && <span className="text-tui-muted mx-0.5">+</span>}
          <kbd className="bg-black text-white px-1.5 py-0.5 rounded-[1px] font-mono text-[10px]">
            {key}
          </kbd>
        </span>
      ))}
      <span className="text-xs font-bold">{description}</span>
    </span>
  );
}
