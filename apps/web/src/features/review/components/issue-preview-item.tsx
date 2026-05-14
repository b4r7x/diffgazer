import { cn } from "@diffgazer/ui/lib/utils";
import type { ReviewSeverity } from '@diffgazer/core/schemas/review';
import { Badge } from '@diffgazer/ui/components/badge';
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
  const isClickable = Boolean(onClick);
  const Tag = isClickable ? "button" : "div";

  return (
    <Tag
      type={isClickable ? "button" : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center justify-between p-3 w-full text-left',
        'bg-tui-bg border-b border-tui-border last:border-b-0',
        isClickable && 'hover:bg-tui-selection cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tui-blue',
        'group transition-colors',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <span className={cn('font-bold text-lg', color)} aria-hidden="true">
          {icon}
        </span>
        <div>
          <div className={cn("text-sm font-bold transition-colors", isClickable && "group-hover:text-tui-blue")}>
            {title}
          </div>
          <div className="text-xs text-tui-muted font-mono">
            {file}:{line}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden sm:inline text-xs text-tui-muted">{category}</span>
        <Badge
          size="sm"
          className={cn(
            'text-[10px] uppercase',
            borderColor,
            color,
            'bg-transparent',
          )}
        >
          {label}
        </Badge>
      </div>
    </Tag>
  );
}
