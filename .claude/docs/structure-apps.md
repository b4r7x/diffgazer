# App Structure Rules (cli, web)

Based on: Bulletproof React (alan2207/bulletproof-react)

---

## Root Structure

```
apps/cli/src/               # or apps/web/src/
├── app/                    # Application layer (routes, providers ONLY)
├── components/             # Shared UI components
├── features/               # Feature modules (PRIMARY)
├── hooks/                  # Shared custom hooks (at src/ level, NOT in app/)
├── lib/                    # Pre-configured libraries
├── stores/                 # Global state
├── types/                  # Shared types
└── index.ts                # Entry point
```

**Critical:**
- `src/hooks/` - only **reusable** hooks shared across multiple features
- `features/app/hooks/` - app-specific hooks (state, navigation)
- `app/` folder contains only screens, views, providers - NO hooks

---

## Naming Conventions

| Element | Convention | Examples |
|---------|------------|----------|
| All files | kebab-case | `chat-input.tsx`, `use-review.ts` |
| Component names | PascalCase | `ChatInput`, `ReviewDisplay` |
| Hook names | camelCase with `use` | `useReview`, `useConfig` |
| Folders | kebab-case | `review-history/`, `chat-input/` |
| Test files | `[name].test.ts(x)` | `use-review.test.ts` |
| Constants | kebab-case file, UPPER_SNAKE values | `constants.ts` → `MAX_RETRIES` |

**Rule:** ALL files in apps/ use kebab-case. No exceptions.

---

## Feature Module Structure

Each feature is self-contained:

```
features/review/
├── api/                    # Data fetching
│   ├── index.ts            # Barrel export
│   ├── reviewApi.ts        # API calls
│   └── triageApi.ts        # Related API calls
│
├── components/             # Feature UI
│   ├── index.ts            # Barrel export
│   ├── review-display.tsx
│   ├── review-screen.tsx
│   ├── review-detail-screen.tsx
│   ├── review-list-item.tsx
│   └── issue-item.tsx
│
├── hooks/                  # Feature hooks
│   ├── index.ts
│   ├── use-review.ts
│   ├── use-triage.ts
│   └── use-review-history.ts
│
├── apps/                   # Standalone mini-apps (CLI specific)
│   ├── interactive-review-app.tsx
│   ├── file-picker-app.tsx
│   └── review-history-app.tsx
│
├── constants.ts            # Feature constants
├── types.ts                # Feature types (if needed)
└── index.ts                # Public exports
```

---

## App Layer Structure

### CLI App

```
app/
├── screens/                # Screen components (equivalent to routes)
│   ├── onboarding-screen.tsx
│   ├── settings-screen.tsx
│   └── ...
│
├── views/                  # View components (sub-screens)
│   ├── index.ts
│   ├── loading-view.tsx
│   └── ...
│
├── provider.tsx            # Context providers (wrap app)
└── app.tsx                 # Main app component

# App-specific hooks in features/app/ (NOT in app/ or src/hooks/)
features/app/
├── hooks/
│   ├── index.ts
│   ├── use-app-state.ts
│   ├── use-navigation.ts
│   └── use-screen-handlers.ts
└── index.ts

# Shared REUSABLE hooks at src/hooks/
hooks/
├── index.ts
├── use-config.ts           # Reusable across features
├── use-async-operation.ts  # Reusable pattern
└── ...
```

**Rules:**
- `src/hooks/` - only **reusable** hooks (used by multiple features)
- `features/app/hooks/` - app-specific hooks (navigation, app state)
- `features/[name]/hooks/` - feature-specific hooks

---

## Colocation Principle

**Keep things close to where they're used.** If something is used only in one place, colocate it.

### Component with dedicated hook/utils/test

```
components/
└── review-card/
    ├── review-card.tsx           # Component
    ├── review-card.test.tsx      # Test (colocated)
    ├── use-review-card.ts        # Hook used ONLY by this component
    ├── review-card.utils.ts      # Utils used ONLY by this component
    └── index.ts                  # Barrel export
```

### Feature with internal structure

```
features/review/
├── api/
│   └── review-api.ts
├── components/
│   ├── review-list/
│   │   ├── review-list.tsx
│   │   ├── review-list.test.tsx
│   │   ├── use-review-list-scroll.ts   # Hook ONLY for this component
│   │   └── index.ts
│   └── review-item/
│       ├── review-item.tsx
│       └── index.ts
├── hooks/
│   ├── use-review.ts             # Used by multiple components in feature
│   └── index.ts
├── utils/
│   └── format-review.ts          # Used by multiple components in feature
└── index.ts
```

### When to colocate vs extract

| Scenario | Location |
|----------|----------|
| Hook used by 1 component | `components/[name]/use-[name].ts` |
| Hook used by multiple components in feature | `features/[name]/hooks/` |
| Hook used by multiple features | `src/hooks/` |
| Test for component | `components/[name]/[name].test.tsx` |
| Utils for 1 component | `components/[name]/[name].utils.ts` |
| Utils for feature | `features/[name]/utils/` |
| Utils shared across features | `src/utils/` |

### Barrel exports for grouped components

```typescript
// components/review-card/index.ts
export { ReviewCard } from './review-card'
export type { ReviewCardProps } from './review-card'
// Don't export internal hooks/utils - they're implementation details
```

### Web App (Future)

```
app/
├── routes/                 # Route definitions
│   ├── index.tsx
│   └── [feature]/
│
├── providers/              # Context providers
│   └── index.tsx
│
└── layout.tsx              # Root layout
```

---

## Shared Components

```
components/
├── ui/                     # Reusable primitives
│   ├── separator.tsx
│   ├── button.tsx
│   └── input.tsx
│
├── settings/               # Settings-related components
│   ├── index.ts
│   ├── settings-header.tsx
│   ├── settings-status.tsx
│   ├── settings-main-view.tsx
│   └── settings-delete-confirm.tsx
│
├── git-status-display.tsx  # Standalone shared components
├── git-diff-display.tsx
├── delete-confirmation.tsx
├── selection-indicator.tsx
├── list-screen-wrapper.tsx
└── index.ts                # Barrel export
```

---

## Import Hierarchy (Unidirectional)

```
┌─────────────────────────────────────┐
│         Shared Modules              │  components/, hooks/, lib/, stores/
│    (Can import from: @repo/*)       │
└────────────────┬────────────────────┘
                 ↑
┌────────────────┴────────────────────┐
│            Features                  │  features/*/
│  (Can import from: shared, @repo/*) │
└────────────────┬────────────────────┘
                 ↑
┌────────────────┴────────────────────┐
│           App Layer                  │  app/
│ (Can import from: shared, features) │
└─────────────────────────────────────┘
```

**Critical Rule:** Features CANNOT import from other features. Composition happens in app layer.

---

## Import Paths

Use absolute imports with `@/` prefix:

```typescript
// ✅ Correct
import { ReviewDisplay } from '@/features/review/components'
import { useConfig } from '@/hooks'
import { Button } from '@/components/ui/button'

// ❌ Wrong
import { ReviewDisplay } from '../../../features/review/components'
```

---

## State Management

| State Type | Location | Tools |
|------------|----------|-------|
| Component state | Within component | `useState` |
| Feature state | `features/*/hooks/` | Custom hooks |
| Global state | `stores/` | Zustand |
| Server cache | `features/*/api/` | React Query / SSE |
| URL state | Route params | React Router / Ink state |

**Rule:** Keep state as close as possible to where it's used.

---

## API Layer Pattern

```typescript
// features/review/api/reviewApi.ts

import { api } from '@/lib/api'
import type { Review } from '@repo/schemas'

export const getReview = async (id: string): Promise<Review> => {
  return api.get(`/reviews/${id}`)
}

export const createReview = async (data: CreateReviewInput): Promise<Review> => {
  return api.post('/reviews', data)
}
```

```typescript
// features/review/hooks/useReview.ts

import { useState, useEffect } from 'react'
import { getReview } from '../api/reviewApi'

export const useReview = (id: string) => {
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  // ...
}
```

---

## Test Placement

Tests co-located with source:

```
features/review/
├── hooks/
│   ├── useReview.ts
│   └── useReview.test.ts    # ✅ Co-located
```

Integration tests in feature root:

```
features/review/
├── __tests__/
│   └── review-flow.integration.test.ts
```

---

## Anti-patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Import feature A from feature B | Compose in app layer |
| `pages/` folder | `screens/` (CLI) or `routes/` (web) |
| `containers/` pattern | Feature-based organization |
| Global `utils/` for feature logic | Feature-specific utils |
| Prop drilling 3+ levels | Context or Zustand |
| `ReviewDisplayComponent.tsx` | `review-display.tsx` |
