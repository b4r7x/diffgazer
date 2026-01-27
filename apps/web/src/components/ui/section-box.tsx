import { cn } from '../../lib/utils';

export interface SectionBoxProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionBox({ title, children, className }: SectionBoxProps) {
  return (
    <div className={cn('border border-[--tui-border]', className)}>
      {title && (
        <div className="px-3 py-1 border-b border-[--tui-border] bg-[--tui-selection]">
          <span className="text-xs font-mono uppercase tracking-wider text-[--tui-muted]">
            {title}
          </span>
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}
