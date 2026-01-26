# Base UI + shadcn Patterns

## Overview

Base UI (by MUI) provides headless, accessible components. Combined with shadcn pattern, we get:
- Unstyled, accessible primitives
- Copy-paste component ownership
- Tailwind CSS styling
- Full customization control

## Installation

```bash
pnpm add @base-ui-components/react
```

## Component Pattern

### 1. Primitive from Base UI
```typescript
// components/ui/dialog.tsx
import * as Dialog from '@base-ui-components/react/dialog';

export function DialogRoot({ children, ...props }) {
  return <Dialog.Root {...props}>{children}</Dialog.Root>;
}

export function DialogTrigger({ children, className, ...props }) {
  return (
    <Dialog.Trigger
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      {children}
    </Dialog.Trigger>
  );
}

export function DialogContent({ children, className, ...props }) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 bg-black/50" />
      <Dialog.Popup
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md rounded-lg bg-white p-6 shadow-xl',
          'dark:bg-neutral-900',
          className
        )}
        {...props}
      >
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  );
}
```

### 2. Styled Variants with CVA
```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline: 'border border-input bg-transparent hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
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
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

## Core Components to Create

### Primitives (from Base UI)
- `button` - With variants
- `dialog` - Modal dialogs
- `popover` - Contextual overlays
- `select` - Dropdowns
- `tabs` - Tab navigation
- `tooltip` - Tooltips
- `menu` - Dropdown menus
- `checkbox` - Checkboxes
- `switch` - Toggle switches
- `progress` - Progress indicators

### Composite Components
- `card` - Content containers
- `badge` - Status indicators
- `alert` - Notifications
- `input` - Text inputs
- `textarea` - Multi-line inputs
- `separator` - Visual dividers
- `skeleton` - Loading placeholders
- `spinner` - Loading spinner

### Domain-Specific (Stargazer)
- `issue-card` - Review issue display
- `severity-badge` - Severity indicator
- `agent-status` - Agent activity indicator
- `code-block` - Syntax highlighted code
- `diff-view` - Git diff display

## Tailwind Config

```typescript
// tailwind.config.ts
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        // Severity colors
        severity: {
          blocker: '#ef4444',
          high: '#f97316',
          medium: '#eab308',
          low: '#3b82f6',
          nit: '#6b7280',
        },
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-in': 'slide-in 200ms ease-out',
      },
    },
  },
};
```

## CSS Variables (globals.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --border: 240 5.9% 90%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --border: 240 3.7% 15.9%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
  }
}
```

## Utility: cn()

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## File Organization

```
components/
└── ui/
    ├── button.tsx
    ├── dialog.tsx
    ├── select.tsx
    ├── tabs.tsx
    ├── card.tsx
    ├── badge.tsx
    ├── input.tsx
    ├── skeleton.tsx
    └── index.ts        # Export all
```
