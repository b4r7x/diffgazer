# Bulletproof React Architecture

## Root Structure

```
src/
├── app/                    # Application layer (routes, providers, router)
├── assets/                 # Static files (images, fonts)
├── components/             # Shared UI components
├── config/                 # Global configurations
├── features/               # Feature modules (PRIMARY)
├── hooks/                  # Shared custom hooks
├── lib/                    # Pre-configured libraries
├── stores/                 # Global state (Zustand)
├── testing/                # Test utilities
├── types/                  # Shared TypeScript types
└── utils/                  # Shared utility functions
```

## Feature Module Structure

```
features/[feature-name]/
├── api/                    # API requests and hooks
├── assets/                 # Feature-specific static files
├── components/             # Feature-scoped components
├── hooks/                  # Feature-specific hooks
├── stores/                 # Feature state management
├── types/                  # Feature TypeScript types
├── utils/                  # Feature utility functions
└── index.ts                # Public exports (barrel file)
```

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `review-panel.tsx` |
| Components | PascalCase | `ReviewPanel` |
| Hooks | camelCase with `use` | `useReview` |
| Folders | kebab-case | `review-panel/` |
| Tests | `[name].test.ts(x)` | `use-review.test.ts` |

## Import Hierarchy (Unidirectional)

```
┌─────────────────────────────┐
│      Shared (components,    │
│      hooks, lib, stores)    │
└──────────────┬──────────────┘
               ↑
┌──────────────┴──────────────┐
│          Features           │
│  (can import from shared)   │
└──────────────┬──────────────┘
               ↑
┌──────────────┴──────────────┐
│        App Layer            │
│ (can import from features)  │
└─────────────────────────────┘
```

## Critical Rules

1. **Features CANNOT import from other features**
   - Composition happens in app layer
   - Use shared components/hooks for cross-feature needs

2. **No barrel files abuse**
   - Direct imports preserve tree-shaking
   - Only export what's truly public

3. **Colocation principle**
   - Keep things close to where they're used
   - Component-specific hooks live with component

4. **State locality**
   - Component state → useState
   - Feature state → feature hooks/stores
   - Global state → stores/

## Component Organization

### Shared components (`components/`)
```
components/
├── ui/                     # Primitives (Button, Input, Card)
│   ├── button.tsx
│   ├── input.tsx
│   └── card.tsx
├── layout/                 # Layout components
│   ├── header.tsx
│   └── sidebar.tsx
└── [domain]/               # Domain-specific shared
    └── issue-card.tsx
```

### Feature components
```
features/review/components/
├── review-panel/
│   ├── review-panel.tsx
│   ├── review-panel.test.tsx
│   ├── use-review-panel.ts    # Hook used ONLY here
│   └── index.ts
└── issue-list/
    ├── issue-list.tsx
    └── index.ts
```

## API Layer Pattern

```typescript
// features/review/api/review-api.ts
import { api } from '@/lib/api';
import type { Review } from '@repo/schemas';

export async function getReview(id: string): Promise<Review> {
  return api.get(`/reviews/${id}`);
}

export async function streamTriage(options: TriageOptions) {
  return api.sse('/triage/stream', options);
}
```

## State Management

| State Type | Location | Tool |
|------------|----------|------|
| Component | Within component | `useState` |
| Feature | `features/*/hooks/` | Custom hooks |
| Global | `stores/` | Zustand |
| Server | `features/*/api/` | React Query / SSE |
| URL | Route params | TanStack Router |

## Test Placement

```
features/review/
├── hooks/
│   ├── use-review.ts
│   └── use-review.test.ts     # Co-located
├── components/
│   ├── review-panel.tsx
│   └── review-panel.test.tsx  # Co-located
└── __tests__/
    └── review-flow.integration.test.ts  # Integration
```

## Anti-patterns

| Don't | Do |
|-------|-----|
| Import feature A from feature B | Compose in app layer |
| Deep prop drilling | Context or Zustand |
| Over-abstract prematurely | Rule of Three |
| Barrel files for everything | Direct imports |
| Global utils for feature logic | Feature-specific utils |
