import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--tui-blue] focus-visible:ring-offset-2 focus-visible:ring-offset-[--tui-bg] disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
    {
        variants: {
            variant: {
                primary: 'bg-[--tui-blue] text-black font-bold hover:bg-[--tui-blue]/90',
                secondary: 'border border-[--tui-border] bg-transparent hover:bg-[--tui-selection]',
                destructive: 'text-[--tui-red] border border-[--tui-red] bg-transparent hover:bg-[--tui-red] hover:text-black',
                ghost: 'bg-transparent hover:bg-[--tui-selection]',
            },
            size: {
                sm: 'h-7 px-3 text-xs',
                md: 'h-9 px-4 py-2 text-sm',
                lg: 'h-11 px-6 py-2 text-base',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';
