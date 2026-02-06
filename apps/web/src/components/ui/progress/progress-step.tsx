import * as React from 'react';
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
      pending: 'text-tui-muted',
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
  children?: React.ReactNode;
  isExpanded?: boolean;
  stepId?: string;
  onToggle?: ((id: string) => void) | (() => void);
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
  stepId,
  onToggle,
  className,
}: ProgressStepProps) {
  const hasContent = Boolean(children || (substeps && substeps.length > 0));

  const handleClick = () => {
    if (hasContent && onToggle) {
      if (stepId) (onToggle as (id: string) => void)(stepId);
      else (onToggle as () => void)();
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
        aria-expanded={hasContent ? isExpanded : undefined}
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
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="pt-2 pl-7">
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
        </div>
      )}
    </div>
  );
}
