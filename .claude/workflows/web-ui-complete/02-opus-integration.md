# Web UI - Opus Integration Workflow

**Model:** Opus 4.5
**Focus:** Backend integration, state management, type safety, complex logic

This workflow wires the Gemini-created UI to the real backend.

---

## Prerequisites

- Gemini workflow (`01-gemini-ui.md`) completed
- All UI components rendering with mock data
- Server (`apps/server`) running
- `@repo/api`, `@repo/schemas`, `@repo/core` built

---

## Phase 1: API Layer Setup

### 1.1 Configure API Client

Create `apps/web/src/lib/api.ts`:

```typescript
import { createApiClient, type ApiClient } from '@repo/api'

// Server runs on localhost:3847 by default
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3847'

export const api: ApiClient = createApiClient({
  baseUrl: API_BASE,
  // CSRF token will be fetched automatically
})

export { API_BASE }
```

### 1.2 Create Health Check Hook

Create `apps/web/src/hooks/use-server-status.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

interface ServerStatus {
  connected: boolean
  version?: string
  error?: string
}

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>({ connected: false })
  const [isChecking, setIsChecking] = useState(true)

  const checkHealth = useCallback(async () => {
    setIsChecking(true)
    try {
      const response = await api.get('/health')
      if (response.ok) {
        setStatus({ connected: true, version: response.version })
      } else {
        setStatus({ connected: false, error: 'Server unhealthy' })
      }
    } catch (error) {
      setStatus({
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      })
    } finally {
      setIsChecking(false)
    }
  }, [])

  useEffect(() => {
    checkHealth()
    // Poll every 30 seconds
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [checkHealth])

  return { ...status, isChecking, retry: checkHealth }
}
```

---

## Phase 2: Feature APIs

### 2.1 Config API

Create `apps/web/src/features/settings/api/config-api.ts`:

```typescript
import { api } from '@/lib/api'
import type { ProviderStatus, ConfigPayload } from '@repo/schemas/settings'

export async function getProviderStatus(): Promise<ProviderStatus> {
  return api.get('/config/status')
}

export async function getConfig(): Promise<ConfigPayload> {
  return api.get('/config')
}

export async function saveConfig(config: ConfigPayload): Promise<void> {
  return api.put('/config', config)
}

export async function validateApiKey(
  provider: string,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  return api.post('/config/validate', { provider, apiKey })
}
```

### 2.2 Review API

Create `apps/web/src/features/review/api/review-api.ts`:

```typescript
import { API_BASE } from '@/lib/api'
import type { TriageOptions, TriageResult } from '@repo/schemas/triage'
import type { AgentStreamEvent } from '@repo/schemas/agent-event'

export interface TriageStreamCallbacks {
  onEvent: (event: AgentStreamEvent) => void
  onError: (error: Error) => void
  onComplete: (result: TriageResult) => void
}

export function streamTriage(
  options: TriageOptions,
  callbacks: TriageStreamCallbacks
): () => void {
  const params = new URLSearchParams()
  params.set('scope', options.scope.type)
  if (options.scope.files) {
    options.scope.files.forEach((f) => params.append('files', f))
  }
  if (options.lenses) {
    options.lenses.forEach((l) => params.append('lenses', l))
  }
  if (options.profile) {
    params.set('profile', options.profile)
  }

  const eventSource = new EventSource(
    `${API_BASE}/triage/stream?${params.toString()}`
  )

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as AgentStreamEvent
      callbacks.onEvent(data)

      if (data.type === 'complete') {
        callbacks.onComplete(data.result)
        eventSource.close()
      }
    } catch (error) {
      callbacks.onError(
        error instanceof Error ? error : new Error('Parse error')
      )
    }
  }

  eventSource.onerror = () => {
    callbacks.onError(new Error('Stream connection failed'))
    eventSource.close()
  }

  // Return cleanup function
  return () => eventSource.close()
}
```

### 2.3 History API

Create `apps/web/src/features/history/api/history-api.ts`:

```typescript
import { api } from '@/lib/api'
import type { ReviewHistoryEntry, ReviewHistoryList } from '@repo/schemas/review-history'
import type { TriageResult } from '@repo/schemas/triage'

export async function getReviewHistory(): Promise<ReviewHistoryList> {
  return api.get('/reviews')
}

export async function getReview(id: string): Promise<TriageResult> {
  return api.get(`/reviews/${id}`)
}

export async function deleteReview(id: string): Promise<void> {
  return api.delete(`/reviews/${id}`)
}
```

### 2.4 Git API

Create `apps/web/src/features/review/api/git-api.ts`:

```typescript
import { api } from '@/lib/api'

export interface GitStatus {
  staged: string[]
  unstaged: string[]
  untracked: string[]
  branch: string
}

export interface GitDiff {
  files: Array<{
    path: string
    status: 'added' | 'modified' | 'deleted'
    additions: number
    deletions: number
    content?: string
  }>
}

export async function getGitStatus(): Promise<GitStatus> {
  return api.get('/git/status')
}

export async function getGitDiff(scope: 'staged' | 'unstaged'): Promise<GitDiff> {
  return api.get(`/git/diff?scope=${scope}`)
}
```

---

## Phase 3: State Management

### 3.1 Config Store

Create `apps/web/src/stores/config-store.ts`:

```typescript
import { create } from 'zustand'
import type { ProviderStatus } from '@repo/schemas/settings'
import { getProviderStatus, saveConfig } from '@/features/settings/api/config-api'

interface ConfigState {
  status: ProviderStatus | null
  isLoading: boolean
  error: string | null

  fetchStatus: () => Promise<void>
  updateConfig: (provider: string, model: string, apiKey?: string) => Promise<void>
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  status: null,
  isLoading: false,
  error: null,

  fetchStatus: async () => {
    set({ isLoading: true, error: null })
    try {
      const status = await getProviderStatus()
      set({ status, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch config',
        isLoading: false,
      })
    }
  },

  updateConfig: async (provider, model, apiKey) => {
    set({ isLoading: true, error: null })
    try {
      await saveConfig({ provider, model, apiKey })
      await get().fetchStatus()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save config',
        isLoading: false,
      })
      throw error
    }
  },
}))
```

### 3.2 Review Store

Create `apps/web/src/stores/review-store.ts`:

```typescript
import { create } from 'zustand'
import type { TriageIssue, TriageResult } from '@repo/schemas/triage'
import type { AgentState } from '@repo/schemas/agent-event'

interface ReviewState {
  // Current review
  isReviewing: boolean
  issues: TriageIssue[]
  agents: AgentState[]
  currentAction: string | null
  error: string | null

  // Selection
  selectedIssueId: string | null

  // Actions
  startReview: () => void
  addEvent: (event: import('@repo/schemas/agent-event').AgentStreamEvent) => void
  completeReview: (result: TriageResult) => void
  setError: (error: string) => void
  selectIssue: (id: string | null) => void
  reset: () => void
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  isReviewing: false,
  issues: [],
  agents: [],
  currentAction: null,
  error: null,
  selectedIssueId: null,

  startReview: () => {
    set({
      isReviewing: true,
      issues: [],
      agents: [],
      currentAction: null,
      error: null,
      selectedIssueId: null,
    })
  },

  addEvent: (event) => {
    const state = get()

    switch (event.type) {
      case 'agent_start': {
        const newAgent: AgentState = {
          id: event.agent.id,
          meta: event.agent,
          status: 'running',
          currentAction: null,
          issueCount: 0,
        }
        set({ agents: [...state.agents, newAgent] })
        break
      }

      case 'agent_action': {
        set({
          currentAction: event.action,
          agents: state.agents.map((a) =>
            a.id === event.agentId
              ? { ...a, currentAction: event.action }
              : a
          ),
        })
        break
      }

      case 'agent_complete': {
        set({
          agents: state.agents.map((a) =>
            a.id === event.agentId
              ? { ...a, status: 'complete', issueCount: event.issueCount, currentAction: null }
              : a
          ),
          currentAction: null,
        })
        break
      }

      case 'issue': {
        const newIssues = [...state.issues, event.issue]
        set({
          issues: newIssues,
          selectedIssueId: state.selectedIssueId ?? event.issue.id,
        })
        break
      }
    }
  },

  completeReview: (result) => {
    set({
      isReviewing: false,
      issues: result.issues,
      selectedIssueId: result.issues[0]?.id ?? null,
    })
  },

  setError: (error) => {
    set({ error, isReviewing: false })
  },

  selectIssue: (id) => {
    set({ selectedIssueId: id })
  },

  reset: () => {
    set({
      isReviewing: false,
      issues: [],
      agents: [],
      currentAction: null,
      error: null,
      selectedIssueId: null,
    })
  },
}))
```

---

## Phase 4: Feature Hooks

### 4.1 Use Triage Stream Hook

Create `apps/web/src/features/review/hooks/use-triage-stream.ts`:

```typescript
import { useCallback, useRef } from 'react'
import { useReviewStore } from '@/stores/review-store'
import { streamTriage } from '../api/review-api'
import type { TriageOptions } from '@repo/schemas/triage'

export function useTriageStream() {
  const cleanupRef = useRef<(() => void) | null>(null)

  const {
    isReviewing,
    issues,
    agents,
    currentAction,
    error,
    selectedIssueId,
    startReview,
    addEvent,
    completeReview,
    setError,
    selectIssue,
    reset,
  } = useReviewStore()

  const start = useCallback((options: TriageOptions) => {
    // Cleanup any existing stream
    cleanupRef.current?.()

    startReview()

    cleanupRef.current = streamTriage(options, {
      onEvent: addEvent,
      onError: (err) => setError(err.message),
      onComplete: completeReview,
    })
  }, [startReview, addEvent, setError, completeReview])

  const stop = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    reset()
  }, [reset])

  return {
    isReviewing,
    issues,
    agents,
    currentAction,
    error,
    selectedIssueId,
    selectIssue,
    start,
    stop,
  }
}
```

### 4.2 Use Config Hook

Create `apps/web/src/features/settings/hooks/use-config.ts`:

```typescript
import { useEffect } from 'react'
import { useConfigStore } from '@/stores/config-store'

export function useConfig() {
  const { status, isLoading, error, fetchStatus, updateConfig } = useConfigStore()

  useEffect(() => {
    if (!status && !isLoading) {
      fetchStatus()
    }
  }, [status, isLoading, fetchStatus])

  return {
    provider: status?.provider,
    model: status?.model,
    isConfigured: status?.configured ?? false,
    isLoading,
    error,
    updateConfig,
    refresh: fetchStatus,
  }
}
```

### 4.3 Use Review History Hook

Create `apps/web/src/features/history/hooks/use-review-history.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { getReviewHistory, getReview, deleteReview } from '../api/history-api'
import type { ReviewHistoryEntry } from '@repo/schemas/review-history'
import type { TriageResult } from '@repo/schemas/triage'

export function useReviewHistory() {
  const [reviews, setReviews] = useState<ReviewHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getReviewHistory()
      setReviews(data.reviews)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch history')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const loadReview = useCallback(async (id: string): Promise<TriageResult> => {
    return getReview(id)
  }, [])

  const removeReview = useCallback(async (id: string) => {
    await deleteReview(id)
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return {
    reviews,
    isLoading,
    error,
    refresh: fetch,
    loadReview,
    removeReview,
  }
}
```

### 4.4 Use Git Status Hook

Create `apps/web/src/features/review/hooks/use-git-status.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { getGitStatus, type GitStatus } from '../api/git-api'

export function useGitStatus() {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getGitStatus()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch git status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return {
    status,
    hasUnstaged: (status?.unstaged.length ?? 0) > 0,
    hasStaged: (status?.staged.length ?? 0) > 0,
    isLoading,
    error,
    refresh: fetch,
  }
}
```

---

## Phase 5: Wire Routes

### 5.1 Update Root Layout

Update `apps/web/src/app/routes/__root.tsx`:

```typescript
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { FooterBar } from '@/components/layout/footer-bar'
import { useConfig } from '@/features/settings/hooks/use-config'
import { useServerStatus } from '@/hooks/use-server-status'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { provider, model, isConfigured } = useConfig()
  const { connected, error: serverError } = useServerStatus()

  // Show connection error if server is down
  if (!connected && serverError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-0">
        <div className="text-center p-8">
          <p className="text-2xl mb-4">🔌</p>
          <p className="text-foreground-0 font-bold mb-2">Server Not Connected</p>
          <p className="text-foreground-2 text-sm">{serverError}</p>
          <p className="text-foreground-2 text-sm mt-4">
            Make sure to run: <code className="bg-background-2 px-2 py-1 rounded">stargazer</code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background-0">
      <Header provider={provider} model={model} />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <FooterBar
        shortcuts={[
          { key: 'r', label: 'review' },
          { key: 'h', label: 'history' },
          { key: 's', label: 'settings' },
        ]}
      />
    </div>
  )
}
```

### 5.2 Update Main Menu

Update `apps/web/src/app/routes/index.tsx`:

```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MainMenu } from '@/features/menu/components/main-menu'
import { useConfig } from '@/features/settings/hooks/use-config'
import { useReviewHistory } from '@/features/history/hooks/use-review-history'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate()
  const { provider, model, isConfigured } = useConfig()
  const { reviews } = useReviewHistory()

  const lastReview = reviews[0]
  const lastReviewAt = lastReview
    ? new Date(lastReview.startedAt).toLocaleString()
    : undefined

  const handleAction = (action: string) => {
    switch (action) {
      case 'review-unstaged':
        navigate({ to: '/review', search: { scope: 'unstaged' } })
        break
      case 'review-staged':
        navigate({ to: '/review', search: { scope: 'staged' } })
        break
      case 'review-files':
        navigate({ to: '/review', search: { scope: 'files' } })
        break
      case 'resume-review':
        if (lastReview) {
          navigate({ to: `/review/${lastReview.id}` })
        }
        break
      case 'history':
        navigate({ to: '/history' })
        break
      case 'settings':
        navigate({ to: '/settings' })
        break
    }
  }

  return (
    <MainMenu
      provider={isConfigured ? provider : undefined}
      model={model}
      lastReviewAt={lastReviewAt}
      hasLastReview={Boolean(lastReview)}
      onAction={handleAction}
    />
  )
}
```

### 5.3 Update Review Route

Update `apps/web/src/app/routes/review/index.tsx`:

```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ReviewScreen } from '@/features/review/components/review-screen'
import { useTriageStream } from '@/features/review/hooks/use-triage-stream'
import { useConfig } from '@/features/settings/hooks/use-config'
import type { TriageScope } from '@repo/schemas/triage'

export const Route = createFileRoute('/review/')({
  component: ReviewPage,
  validateSearch: (search: Record<string, unknown>): { scope?: string } => {
    return { scope: search.scope as string | undefined }
  },
})

function ReviewPage() {
  const navigate = useNavigate()
  const { scope } = Route.useSearch()
  const { isConfigured } = useConfig()

  const {
    isReviewing,
    issues,
    agents,
    error,
    selectedIssueId,
    selectIssue,
    start,
    stop,
  } = useTriageStream()

  // Redirect to settings if not configured
  useEffect(() => {
    if (!isConfigured) {
      navigate({ to: '/settings' })
    }
  }, [isConfigured, navigate])

  // Start review when page loads with scope
  useEffect(() => {
    if (scope && isConfigured && !isReviewing && issues.length === 0) {
      const triageScope: TriageScope = { type: scope as 'unstaged' | 'staged' | 'files' }
      start({ scope: triageScope })
    }
  }, [scope, isConfigured, isReviewing, issues.length, start])

  // Cleanup on unmount
  useEffect(() => {
    return () => stop()
  }, [stop])

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-status-error mb-4">{error}</p>
        <button
          onClick={() => navigate({ to: '/' })}
          className="text-accent hover:underline"
        >
          Back to menu
        </button>
      </div>
    )
  }

  return (
    <ReviewScreen
      issues={issues}
      agents={agents}
      isReviewing={isReviewing}
      selectedIssueId={selectedIssueId}
      onSelectIssue={selectIssue}
      onApplyPatch={(id) => {
        // TODO: Implement patch application
        console.log('Apply patch:', id)
      }}
      onExplain={(id) => {
        // TODO: Implement drilldown
        console.log('Explain:', id)
      }}
    />
  )
}
```

### 5.4 Update History Route

Update `apps/web/src/app/routes/history.tsx`:

```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { HistoryList } from '@/features/history/components/history-list'
import { useReviewHistory } from '@/features/history/hooks/use-review-history'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/history')({
  component: HistoryPage,
})

function HistoryPage() {
  const navigate = useNavigate()
  const { reviews, isLoading, error, refresh } = useReviewHistory()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-status-error mb-4">{error}</p>
        <button onClick={refresh} className="text-accent hover:underline">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground-0">Review History</h1>
        <button onClick={refresh} className="text-accent hover:underline text-sm">
          Refresh
        </button>
      </div>
      <HistoryList
        reviews={reviews}
        onSelect={(id) => navigate({ to: `/review/${id}` })}
      />
    </div>
  )
}
```

### 5.5 Update Settings Route

Update `apps/web/src/app/routes/settings.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useConfig } from '@/features/settings/hooks/use-config'
import { validateApiKey } from '@/features/settings/api/config-api'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { provider, model, isConfigured, isLoading, updateConfig, refresh } = useConfig()

  const [selectedProvider, setSelectedProvider] = useState(provider ?? 'anthropic')
  const [selectedModel, setSelectedModel] = useState(model ?? 'claude-sonnet-4')
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Validate API key if provided
      if (apiKey) {
        const validation = await validateApiKey(selectedProvider, apiKey)
        if (!validation.valid) {
          setError(validation.error ?? 'Invalid API key')
          setIsSaving(false)
          return
        }
      }

      await updateConfig(selectedProvider, selectedModel, apiKey || undefined)
      setSuccess(true)
      setApiKey('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold text-foreground-0">Settings</h1>

      {/* Provider Settings */}
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-status-error text-sm">{error}</p>
          )}
          {success && (
            <p className="text-status-complete text-sm">Settings saved!</p>
          )}

          <div>
            <label className="block text-sm text-foreground-2 mb-1">Provider</label>
            <Select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm text-foreground-2 mb-1">Model</label>
            <Select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {selectedProvider === 'anthropic' && (
                <>
                  <option value="claude-sonnet-4">Claude Sonnet 4</option>
                  <option value="claude-opus-4">Claude Opus 4</option>
                </>
              )}
              {selectedProvider === 'openai' && (
                <>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </>
              )}
              {selectedProvider === 'google' && (
                <>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </>
              )}
            </Select>
          </div>

          <div>
            <label className="block text-sm text-foreground-2 mb-1">
              API Key {isConfigured && '(leave empty to keep current)'}
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isConfigured ? '••••••••' : 'Enter API key'}
            />
          </div>

          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-foreground-2">Configured:</span>{' '}
              <span className={isConfigured ? 'text-status-complete' : 'text-status-error'}>
                {isConfigured ? 'Yes' : 'No'}
              </span>
            </p>
            {isConfigured && (
              <>
                <p>
                  <span className="text-foreground-2">Provider:</span> {provider}
                </p>
                <p>
                  <span className="text-foreground-2">Model:</span> {model}
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Phase 6: CLI Integration

### 6.1 Add Web Command to CLI

Create `apps/cli/src/commands/web.ts`:

```typescript
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

export interface WebCommandOptions {
  port?: number
  open?: boolean
}

export async function runWebCommand(options: WebCommandOptions = {}): Promise<void> {
  const port = options.port ?? 5173
  const webDir = resolve(__dirname, '../../web')

  // Check if web app is built
  const distDir = resolve(webDir, 'dist')
  if (!existsSync(distDir)) {
    console.error('Web app not built. Run: pnpm --filter web build')
    process.exit(1)
  }

  // Start preview server
  const preview = spawn('pnpm', ['preview', '--port', String(port)], {
    cwd: webDir,
    stdio: 'inherit',
  })

  // Open browser if requested
  if (options.open) {
    const url = `http://localhost:${port}`
    const openCommand = process.platform === 'darwin' ? 'open' :
                        process.platform === 'win32' ? 'start' : 'xdg-open'
    spawn(openCommand, [url], { stdio: 'ignore', detached: true })
  }

  preview.on('error', (err) => {
    console.error('Failed to start web server:', err.message)
    process.exit(1)
  })

  // Handle cleanup
  process.on('SIGINT', () => {
    preview.kill()
    process.exit(0)
  })
}
```

### 6.2 Register Web Command

Update `apps/cli/src/index.ts` to add the web command:

```typescript
// Add to command registration
program
  .command('web')
  .description('Open web UI')
  .option('-p, --port <port>', 'Port number', '5173')
  .option('-o, --open', 'Open browser automatically')
  .action(async (options) => {
    const { runWebCommand } = await import('./commands/web.js')
    await runWebCommand({
      port: parseInt(options.port),
      open: options.open,
    })
  })
```

---

## Phase 7: Install Dependencies

### 7.1 Add Zustand

```bash
cd apps/web
pnpm add zustand
```

### 7.2 Update package.json scripts

Update `apps/web/package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  }
}
```

---

## Phase 8: Validation

### 8.1 Type Check

```bash
pnpm type-check
```

### 8.2 Build

```bash
pnpm build
```

### 8.3 Integration Test

1. Start server: `cd apps/server && pnpm dev`
2. Start web: `cd apps/web && pnpm dev`
3. Test flows:
   - [ ] Main menu renders with real provider status
   - [ ] Starting review creates SSE stream
   - [ ] Agent events show in real-time
   - [ ] Issues appear as they're found
   - [ ] Review history loads
   - [ ] Settings save and persist
   - [ ] Error states display correctly

---

## Deliverables Checklist

After completing this workflow:

- [ ] API client configured
- [ ] All feature APIs (config, review, history, git)
- [ ] Zustand stores (config, review)
- [ ] Feature hooks (triage stream, config, history, git status)
- [ ] Routes wired to real data
- [ ] Server connection check
- [ ] CLI web command
- [ ] Error handling throughout
- [ ] Type safety verified
- [ ] Build passes
- [ ] Integration works end-to-end

---

## Troubleshooting

### CORS Errors

Server should already allow localhost origins. If issues:
- Check server is running on 127.0.0.1:3847
- Verify CORS config in `apps/server/src/middleware/cors.ts`

### SSE Not Working

- Check EventSource URL is correct
- Verify server sends proper SSE headers
- Check browser console for connection errors

### State Not Updating

- Verify Zustand store actions are called
- Check React DevTools for state
- Ensure components are subscribed to store
