# Quickstart: Shared API Hooks

**Feature Branch**: `006-shared-api-hooks`

## Setup (both apps)

### 1. Install TanStack Query

```bash
pnpm --filter @diffgazer/api add @tanstack/react-query
# Note: react is already a dependency in both apps
```

### 2. Wrap app in providers

```tsx
// In each app's root component
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ApiProvider } from '@diffgazer/api/hooks'
import { createApi } from '@diffgazer/api'

// CLI
const api = createApi({ baseUrl: 'http://127.0.0.1:3000', projectRoot: process.cwd() })
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'always', refetchOnWindowFocus: false, refetchOnReconnect: false, retry: 1, staleTime: 30_000 },
    mutations: { networkMode: 'always' },
  },
})

// Web
const api = createApi({ baseUrl: getDefaultApiUrl() })
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 2 } },
})

// Both
<QueryClientProvider client={queryClient}>
  <ApiProvider value={api}>
    <App />
  </ApiProvider>
</QueryClientProvider>
```

### 3. Use shared hooks

```tsx
import { useSettings, useSaveSettings } from '@diffgazer/api/hooks'

function SettingsPage() {
  const { data: settings, isLoading, error } = useSettings()
  const saveSettings = useSaveSettings()

  if (isLoading) return <Loading />
  if (error) return <Error message={error.message} />

  return (
    <Form
      onSubmit={(values) => saveSettings.mutate(values)}
      isPending={saveSettings.isPending}
    />
  )
}
```

## Build & Test

```bash
# Build the API package (includes new hooks)
pnpm --filter @diffgazer/api build

# Type check
pnpm --filter @diffgazer/api type-check

# Run tests
pnpm --filter @diffgazer/api test
```

## Migration Pattern (per hook)

1. Identify the CLI/web hook to replace
2. Find the corresponding shared hook in `@diffgazer/api/hooks`
3. Replace the import
4. Update the consuming component to use TanStack Query's return shape (`data`, `isLoading`, `error` instead of custom field names like `settings`, `isLoading`, `error`)
5. Delete the old app-specific hook file
6. Verify both apps still work
