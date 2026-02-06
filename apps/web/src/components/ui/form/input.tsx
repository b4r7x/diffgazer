import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

export const inputVariants = cva(
  'flex w-full bg-tui-bg border border-tui-border text-tui-fg font-mono placeholder:text-tui-fg/50 transition-colors focus:border-tui-blue focus:ring-1 focus:ring-tui-blue focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'h-7 px-2 py-1 text-xs',
        md: 'h-9 px-3 py-2 text-sm',
        lg: 'h-11 px-4 py-2 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({ className, size, ref, ...props }: InputProps) {
  return (
    <input
      className={cn(inputVariants({ size, className }))}
      ref={ref}
      {...props}
    />
  );
}
