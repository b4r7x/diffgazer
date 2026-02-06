import { useRef, useLayoutEffect, useState, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/badge';
import { ProgressSubstep } from './progress-substep';
import type { ProgressStatus, ProgressSubstepData } from '@stargazer/schemas/ui';

export type { ProgressStatus };

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
  substeps?: ProgressSubstepData[];
  children?: ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

const STATUS_BADGES: Record<ProgressStatus, { label: string; variant: "success" | "info" | "neutral" }> = {
  completed: { label: "DONE", variant: "success" },
  active: { label: "RUN", variant: "info" },
  pending: { label: "WAIT", variant: "neutral" },
};

export function ProgressStep({
  label,
  status,
  substeps,
  children,
  isExpanded = false,
  onToggle,
  className,
}: ProgressStepProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const hasContent = Boolean(children || (substeps && substeps.length > 0));

  useLayoutEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children, substeps, isExpanded]);

  const handleClick = () => {
    if (hasContent && onToggle) {
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
          hasContent && 'cursor-pointer'
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={hasContent ? 0 : undefined}
        role={hasContent ? 'button' : undefined}
      >
        <span className="shrink-0">
          <Badge variant={STATUS_BADGES[status].variant} size="sm" className="min-w-[48px] justify-center">
            {STATUS_BADGES[status].label}
          </Badge>
        </span>
        <span className={labelVariants({ status })}>{label}</span>
      </div>
      {hasContent && (
        <div
          style={{ height: isExpanded ? contentHeight : 0 }}
          className="overflow-hidden transition-[height] duration-200 ease-in-out"
        >
          <div ref={contentRef} className="pt-2 pl-7">
            {substeps && substeps.length > 0 && (
              <div className="space-y-1 mb-2">
                {substeps.map((substep) => (
                  <ProgressSubstep key={substep.id} {...substep} />
                ))}
              </div>
            )}
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
