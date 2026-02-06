import { cn } from '@/utils/cn';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  orientation?: 'vertical' | 'horizontal' | 'both';
  ref?: React.Ref<HTMLDivElement>;
}

export function ScrollArea({ children, className, orientation = 'vertical', ref, ...props }: ScrollAreaProps) {
  return (
    <div
      ref={ref}
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
