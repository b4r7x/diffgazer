import { cn } from "@/lib/utils";
import type { ReviewSeverity } from '@stargazer/schemas/review';
import { SEVERITY_CONFIG } from '@/components/ui/severity/constants';

export interface IssuePreviewItemProps {
  title: string;
  file: string;
  line: number;
  category: string;
  severity: ReviewSeverity;
  onClick?: () => void;
  className?: string;
}

export function IssuePreviewItem({
  title,
  file,
  line,
  category,
  severity,
  onClick,
  className,
}: IssuePreviewItemProps) {
  const { icon, color, label, borderColor } = SEVERITY_CONFIG[severity];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between p-3 w-full text-left',
        'bg-tui-bg border-b border-gray-800 last:border-b-0',
        'hover:bg-tui-selection group cursor-pointer transition-colors',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <span className={cn('font-bold text-lg', color)} aria-hidden="true">
          {icon}
        </span>
        <div>
          <div className="text-sm font-bold group-hover:text-tui-blue transition-colors">
            {title}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {file}:{line}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden sm:inline text-xs text-gray-500">{category}</span>
        <span
          className={cn(
            'text-[10px] border px-1.5 py-0.5 uppercase tracking-wide',
            borderColor,
            color
          )}
        >
          {label}
        </span>
      </div>
    </button>
  );
}
