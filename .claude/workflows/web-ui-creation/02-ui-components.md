# Phase 2: UI Components

Create core UI components using Base UI + Tailwind.

## Agent

```
subagent_type: "frontend-developer"
```

## Tasks

### 2.1 Button Component

Create `src/components/ui/button.tsx`:

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline: 'border border-border bg-transparent hover:bg-muted',
        ghost: 'hover:bg-muted hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  isLoading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

export { buttonVariants };
```

### 2.2 Card Component

Create `src/components/ui/card.tsx`:

```typescript
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div className={cn('flex items-center p-6 pt-0', className)} {...props} />
  );
}
```

### 2.3 Badge Component

Create `src/components/ui/badge.tsx`:

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-muted text-muted-foreground',
        outline: 'border border-border text-foreground',
        // Severity variants
        blocker: 'bg-severity-blocker text-white',
        high: 'bg-severity-high text-white',
        medium: 'bg-severity-medium text-black',
        low: 'bg-severity-low text-white',
        nit: 'bg-severity-nit text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
```

### 2.4 Dialog Component

Create `src/components/ui/dialog.tsx`:

```typescript
import * as DialogPrimitive from '@base-ui-components/react/dialog';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in"
      />
      <DialogPrimitive.Popup
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md rounded-lg bg-background p-6 shadow-xl',
          'data-[state=open]:animate-slide-in',
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn('mt-2 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export const DialogClose = DialogPrimitive.Close;
```

### 2.5 Tabs Component

Create `src/components/ui/tabs.tsx`:

```typescript
import * as TabsPrimitive from '@base-ui-components/react/tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1',
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[selected]:bg-background data-[selected]:shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn('mt-2 focus-visible:outline-none', className)}
      {...props}
    />
  );
}
```

### 2.6 Skeleton Component

Create `src/components/ui/skeleton.tsx`:

```typescript
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}
```

### 2.7 Input Component

Create `src/components/ui/input.tsx`:

```typescript
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-red-500 focus-visible:ring-red-500',
        className
      )}
      {...props}
    />
  );
}
```

### 2.8 Progress Component

Create `src/components/ui/progress.tsx`:

```typescript
import * as ProgressPrimitive from '@base-ui-components/react/progress';
import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export function Progress({ value, max = 100, className }: ProgressProps) {
  const percentage = Math.round((value / max) * 100);

  return (
    <ProgressPrimitive.Root value={value} max={max}>
      <ProgressPrimitive.Track
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-muted',
          className
        )}
      >
        <ProgressPrimitive.Indicator
          className="h-full bg-primary transition-all"
          style={{ width: `${percentage}%` }}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}
```

### 2.9 Create Index

Create `src/components/ui/index.ts`:

```typescript
export { Button, buttonVariants } from './button';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
export { Badge } from './badge';
export { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from './dialog';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
export { Skeleton } from './skeleton';
export { Input } from './input';
export { Progress } from './progress';
```

## Validation

```bash
pnpm type-check
```

Create a test page to verify all components render correctly.

## Output

Core UI components created:
- Button with variants
- Card with subcomponents
- Badge with severity colors
- Dialog (modal)
- Tabs
- Skeleton
- Input
- Progress
