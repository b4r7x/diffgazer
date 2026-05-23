import { cn } from "@diffgazer/ui/lib/utils";
import type { ReviewSeverity } from '@diffgazer/core/schemas/review';
import { Badge } from '@diffgazer/ui/components/badge';
import { Button } from '@diffgazer/ui/components/button';
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

function IssuePreviewContent({
  title,
  file,
  line,
  category,
  icon,
  color,
  label,
  borderColor,
  isClickable,
}: {
  title: string;
  file: string;
  line: number;
  category: string;
  icon: string;
  color: string;
  label: string;
  borderColor: string;
  isClickable: boolean;
}) {
  return (
    <>
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
            'text-2xs uppercase',
            borderColor,
            color,
            'bg-transparent',
          )}
        >
          {label}
        </Badge>
      </div>
    </>
  );
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
  const contentProps = { title, file, line, category, icon, color, label, borderColor };
  const sharedClassName = cn(
    'flex items-center justify-between p-3 w-full text-left',
    'bg-tui-bg border-b border-tui-border last:border-b-0',
    'group transition-colors',
    className,
  );

  if (onClick) {
    return (
      <Button
        variant="ghost"
        onClick={onClick}
        className={cn(
          sharedClassName,
          'h-auto justify-between rounded-none hover:bg-tui-selection focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tui-blue',
        )}
      >
        <IssuePreviewContent {...contentProps} isClickable />
      </Button>
    );
  }

  return (
    <div className={sharedClassName}>
      <IssuePreviewContent {...contentProps} isClickable={false} />
    </div>
  );
}
