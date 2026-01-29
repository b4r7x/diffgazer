'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export type ProgressStatus = 'completed' | 'active' | 'pending';

const progressStepVariants = cva('flex items-start gap-3', {
  variants: {
    status: {
      completed: '',
      active: 'bg-tui-selection py-2 -mx-3 px-3 rounded border-l-2 border-tui-blue',
      pending: '',
    },
  },
  defaultVariants: {
    status: 'pending',
  },
});

const indicatorVariants = cva('font-mono text-sm shrink-0 w-4 text-center', {
  variants: {
    status: {
      completed: 'text-tui-green',
      active: 'text-tui-blue',
      pending: 'text-gray-600',
    },
  },
  defaultVariants: {
    status: 'pending',
  },
});

const labelVariants = cva('text-sm', {
  variants: {
    status: {
      completed: 'text-tui-fg',
      active: 'font-bold text-tui-blue',
      pending: 'text-gray-600',
    },
  },
  defaultVariants: {
    status: 'pending',
  },
});

export interface ProgressStepProps extends VariantProps<typeof progressStepVariants> {
  label: string;
  status: ProgressStatus;
  children?: ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

const STATUS_INDICATORS: Record<ProgressStatus, string> = {
  completed: '✓',
  active: '▶',
  pending: '○',
};

export function ProgressStep({
  label,
  status,
  children,
  isExpanded = false,
  onToggle,
  className,
}: ProgressStepProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const hasChildren = Boolean(children);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children, isExpanded]);

  const handleClick = () => {
    if (hasChildren && onToggle) {
      onToggle();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div className={className}>
      <div
        className={cn(
          progressStepVariants({ status }),
          hasChildren && 'cursor-pointer'
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={hasChildren ? 0 : undefined}
        role={hasChildren ? 'button' : undefined}
      >
        <span className={indicatorVariants({ status })}>
          {STATUS_INDICATORS[status]}
        </span>
        <span className={labelVariants({ status })}>{label}</span>
      </div>
      {hasChildren && (
        <div
          style={{ height: isExpanded ? contentHeight : 0 }}
          className="overflow-hidden transition-[height] duration-200 ease-in-out"
        >
          <div ref={contentRef} className="pt-2 pl-7">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
