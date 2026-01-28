import { cn } from '../../lib/utils';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  orientation?: 'vertical' | 'horizontal' | 'both';
}

export function ScrollArea({
  children,
  className,
  orientation = 'vertical',
  ...props
}: ScrollAreaProps) {
  return (
    <div
      className={cn(
        'scrollbar-thin',
        orientation === 'vertical' && 'overflow-y-auto',
        orientation === 'horizontal' && 'overflow-x-auto',
        orientation === 'both' && 'overflow-auto',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
