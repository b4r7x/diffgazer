# Contract: Shared Functions Being Extracted

## `@diffgazer/core/format` additions

```typescript
/**
 * Returns provider connection status for header display.
 * Both CLI and web global layouts use this.
 */
export function getProviderStatus(
  isLoading: boolean,
  isConfigured: boolean,
): "active" | "idle";

/**
 * Returns human-readable provider name for header display.
 * Shows "provider / model" when both available, just provider, or "Not configured".
 */
export function getProviderDisplay(
  provider?: string,
  model?: string,
): string;
```

## `@diffgazer/core/review` additions

```typescript
import type { StepState, AgentState } from "@diffgazer/schemas/events";

/**
 * Maps internal step status to UI-friendly status.
 * Used by both CLI and web review progress views.
 */
export function mapStepStatus(
  status: StepState["status"],
): "pending" | "running" | "complete" | "error";

/**
 * Returns human-readable agent detail string for review progress substeps.
 * Shows progress %, issue count, "error", or "queued".
 */
export function getAgentDetail(agent: AgentState): string;
```

## `@diffgazer/schemas/ui` additions

```typescript
/**
 * Maps log entry tags to badge variants.
 * Canonical source — both CLI and web activity logs import this.
 * agent maps to "info" (web is source of truth).
 */
export const TAG_BADGE_VARIANTS: Record<string, string>;
// { system: "default", agent: "info", tool: "warning", error: "destructive" }
```

## CLI `useReviewStart` rewrite contract

The rewritten CLI hook adopts the web's dependency-injection interface:

```typescript
interface UseReviewStartOptions {
  mode: ReviewMode;
  configLoading: boolean;
  settingsLoading: boolean;
  isConfigured: boolean;
  defaultLenses: LensId[];
  start: (options: { mode?: ReviewMode; lenses?: LensId[] }) => Promise<void>;
  resume: (id: string) => Promise<void>;
  getActiveSession: (mode: ReviewMode) => Promise<{ session: { reviewId: string } | null }>;
}

function useReviewStart(options: UseReviewStartOptions): {
  hasStartedRef: React.RefObject<boolean>;
  hasStreamedRef: React.RefObject<boolean>;
};
```

Key behavior: single `useEffect`, imperative session check with `.catch()` fallback, no intermediate phases.
