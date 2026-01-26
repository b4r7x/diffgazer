# Phase 1: Project Setup

Initialize Vite React project with all dependencies and structure.

## Agent

```
subagent_type: "frontend-developer"
```

## Tasks

### 1.1 Create Vite Project

```bash
cd /Users/voitz/Projects/stargazer/apps
pnpm create vite web --template react-ts
cd web
```

### 1.2 Install Dependencies

```bash
# Core
pnpm add react@19 react-dom@19

# UI
pnpm add @base-ui-components/react
pnpm add class-variance-authority clsx tailwind-merge

# Routing
pnpm add @tanstack/react-router

# Styling
pnpm add -D tailwindcss postcss autoprefixer

# Workspace packages
pnpm add @repo/api @repo/schemas @repo/core
```

### 1.3 Initialize Tailwind

```bash
npx tailwindcss init -p
```

Create `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
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
        severity: {
          blocker: '#ef4444',
          high: '#f97316',
          medium: '#eab308',
          low: '#3b82f6',
          nit: '#6b7280',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### 1.4 Configure Path Aliases

Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 1.5 Create Directory Structure

```bash
mkdir -p src/app/routes
mkdir -p src/components/ui
mkdir -p src/components/layout
mkdir -p src/features/review/api
mkdir -p src/features/review/components
mkdir -p src/features/review/hooks
mkdir -p src/features/settings/api
mkdir -p src/features/settings/components
mkdir -p src/features/settings/hooks
mkdir -p src/features/agents/components
mkdir -p src/hooks
mkdir -p src/lib
mkdir -p src/stores
mkdir -p src/types
```

### 1.6 Create Base Files

Create `src/lib/utils.ts`:
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Create `src/index.css`:
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
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --border: 240 3.7% 15.9%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
  }
}
```

## Validation

```bash
cd apps/web
pnpm type-check
pnpm build
```

## Output

Project initialized with:
- Vite + React 19 + TypeScript
- Tailwind CSS configured
- Path aliases working
- Directory structure created
- Base utilities in place
