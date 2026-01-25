# @repo/schemas

Canonical type definitions using Zod. All shared types should be defined here using Zod schemas, then exported as TypeScript types via `z.infer<>`.

## Installation

```typescript
import { ReviewResultSchema, type ReviewResult } from "@repo/schemas/review";
import { UserConfigSchema, type UserConfig } from "@repo/schemas/config";
import { SettingsConfigSchema, type SettingsConfig } from "@repo/schemas/settings";
```

## Design Principles

1. **Single Source of Truth**: All shared types defined here
2. **Runtime Validation**: Zod provides both types and validation
3. **Type Inference**: Use `z.infer<typeof Schema>` for types

```typescript
// Define schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

// Infer type
export type User = z.infer<typeof UserSchema>;
// { id: string; name: string }

// Validate at runtime
const result = UserSchema.safeParse(data);
if (result.success) {
  // result.data is typed as User
}
```

## Schema Categories

### Lens Schemas

```typescript
import {
  LensIdSchema,
  LensSchema,
  ProfileIdSchema,
  ReviewProfileSchema,
  DrilldownResultSchema,
  LENS_IDS,
  PROFILE_IDS,
  type LensId,
  type Lens,
  type ProfileId,
  type ReviewProfile,
  type DrilldownResult,
} from "@repo/schemas/lens";
```

#### Lens IDs

```typescript
export const LENS_IDS = [
  "correctness",
  "security",
  "performance",
  "simplicity",
  "tests",
] as const;
```

| Lens | Focus |
|------|-------|
| `correctness` | Bugs, logic errors, edge cases |
| `security` | Vulnerabilities, injection, auth |
| `performance` | Efficiency, memory, algorithms |
| `simplicity` | Complexity, maintainability |
| `tests` | Test coverage, quality |

#### Profile IDs

```typescript
export const PROFILE_IDS = ["quick", "strict", "perf", "security"] as const;
```

| Profile | Lenses | Min Severity |
|---------|--------|--------------|
| `quick` | correctness | high |
| `strict` | correctness, security, tests | all |
| `perf` | correctness, performance | medium |
| `security` | security, correctness | all |

#### DrilldownResult

```typescript
const DrilldownResultSchema = z.object({
  issueId: z.string(),
  issue: TriageIssueSchema,
  detailedAnalysis: z.string(),
  rootCause: z.string(),
  impact: z.string(),
  suggestedFix: z.string(),
  patch: z.string().nullable(),
  relatedIssues: z.array(z.string()),
  references: z.array(z.string()),
  trace: z.array(TraceRefSchema).optional(),
});
```

### Triage Schemas

```typescript
import {
  TriageSeveritySchema,
  TriageCategorySchema,
  TriageIssueSchema,
  TriageResultSchema,
  TraceRefSchema,
  TRIAGE_SEVERITIES,
  TRIAGE_CATEGORIES,
  type TriageSeverity,
  type TriageCategory,
  type TriageIssue,
  type TriageResult,
} from "@repo/schemas/triage";
```

#### Severity Levels

```typescript
export const TRIAGE_SEVERITIES = ["blocker", "high", "medium", "low", "nit"] as const;
```

| Severity | Description | Action |
|----------|-------------|--------|
| `blocker` | Critical issue, must fix | Block merge |
| `high` | Important issue | Review required |
| `medium` | Should address | Recommended |
| `low` | Minor issue | Optional |
| `nit` | Style/nitpick | Informational |

#### TriageIssue

```typescript
const TriageIssueSchema = z.object({
  id: z.string(),
  severity: TriageSeveritySchema,
  category: TriageCategorySchema,
  file: z.string(),
  line: z.number().nullable(),
  endLine: z.number().nullable(),
  title: z.string(),
  description: z.string(),
  suggestion: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
```

### Settings Schemas

```typescript
import {
  SettingsConfigSchema,
  TrustConfigSchema,
  TrustCapabilitiesSchema,
  ThemeSchema,
  ControlsModeSchema,
  TrustModeSchema,
  THEMES,
  CONTROLS_MODES,
  TRUST_MODES,
  type SettingsConfig,
  type TrustConfig,
  type TrustCapabilities,
  type Theme,
  type ControlsMode,
  type TrustMode,
} from "@repo/schemas/settings";
```

#### SettingsConfig

```typescript
const SettingsConfigSchema = z.object({
  theme: ThemeSchema,
  controlsMode: ControlsModeSchema,
  defaultLenses: z.array(LensIdSchema),
  defaultProfile: ProfileIdSchema.nullable(),
  severityThreshold: TriageSeveritySchema,
});
```

| Field | Type | Description |
|-------|------|-------------|
| `theme` | `"auto" \| "dark" \| "light" \| "terminal"` | UI color theme |
| `controlsMode` | `"menu" \| "keys"` | Show menu or keyboard shortcuts |
| `defaultLenses` | `LensId[]` | Default lenses for reviews |
| `defaultProfile` | `ProfileId \| null` | Default review profile |
| `severityThreshold` | `TriageSeverity` | Minimum severity to show |

#### TrustConfig

```typescript
const TrustConfigSchema = z.object({
  projectId: z.string(),
  repoRoot: z.string(),
  trustedAt: z.string().datetime(),
  capabilities: TrustCapabilitiesSchema,
  trustMode: TrustModeSchema,
});

const TrustCapabilitiesSchema = z.object({
  readFiles: z.boolean(),
  readGit: z.boolean(),
  runCommands: z.boolean(),
});
```

### Session Schemas

```typescript
import {
  SessionSchema,
  SessionMetadataSchema,
  SessionMessageSchema,
  SessionEventSchema,
  SessionEventTypeSchema,
  MessageRoleSchema,
  SESSION_EVENT_TYPES,
  MESSAGE_ROLES,
  type Session,
  type SessionMetadata,
  type SessionMessage,
  type SessionEvent,
  type SessionEventType,
  type MessageRole,
} from "@repo/schemas/session";
```

#### Session Event Types

```typescript
export const SESSION_EVENT_TYPES = [
  "NAVIGATE",
  "OPEN_ISSUE",
  "TOGGLE_VIEW",
  "APPLY_PATCH",
  "IGNORE_ISSUE",
  "FILTER_CHANGED",
  "RUN_CREATED",
  "RUN_RESUMED",
  "SETTINGS_CHANGED",
] as const;
```

| Event Type | Trigger |
|------------|---------|
| `NAVIGATE` | Screen change |
| `OPEN_ISSUE` | Issue drilldown |
| `TOGGLE_VIEW` | View mode change |
| `APPLY_PATCH` | Patch applied |
| `IGNORE_ISSUE` | Issue dismissed |
| `FILTER_CHANGED` | Filter update |
| `RUN_CREATED` | New review |
| `RUN_RESUMED` | Resume review |
| `SETTINGS_CHANGED` | Settings update |

#### SessionEvent

```typescript
const SessionEventSchema = z.object({
  ts: z.number(),
  type: SessionEventTypeSchema,
  payload: z.unknown(),
});
```

### Config Schemas

```typescript
import {
  AIProviderSchema,
  UserConfigSchema,
  SaveConfigRequestSchema,
  GEMINI_MODELS,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  AVAILABLE_PROVIDERS,
  type AIProvider,
  type UserConfig,
  type GeminiModel,
  type ProviderStatus,
} from "@repo/schemas/config";
```

#### AI Providers

```typescript
export const AI_PROVIDERS = ["gemini", "openai", "anthropic"] as const;
```

#### Models by Provider

```typescript
// Gemini
export const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.5-flash",      // Recommended (free tier)
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
] as const;

// OpenAI
export const OPENAI_MODELS = [
  "gpt-4o",                // Recommended
  "gpt-4o-mini",
  "gpt-4-turbo",
  "o1-preview",
  "o1-mini",
] as const;

// Anthropic
export const ANTHROPIC_MODELS = [
  "claude-sonnet-4-20250514",     // Recommended
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
] as const;
```

### Error Schemas

```typescript
import {
  SharedErrorCodeSchema,
  createDomainErrorCodes,
  createDomainErrorSchema,
  ErrorCode,
  type SharedErrorCode,
} from "@repo/schemas/errors";
```

#### Shared Error Codes

```typescript
export const SHARED_ERROR_CODES = [
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "INTERNAL_ERROR",
  "RATE_LIMITED",
  "API_KEY_MISSING",
] as const;
```

#### Domain-Specific Errors

Use `createDomainErrorCodes` to combine shared codes with domain-specific ones:

```typescript
export const LENS_SPECIFIC_CODES = ["NO_DIFF", "AI_ERROR", "LENS_NOT_FOUND", "PROFILE_NOT_FOUND"] as const;
export const LENS_ERROR_CODES = createDomainErrorCodes(LENS_SPECIFIC_CODES);
// ["VALIDATION_ERROR", "NOT_FOUND", ..., "NO_DIFF", "AI_ERROR", ...]
```

## Common Patterns

### Timestamp Fields

```typescript
import { timestampFields } from "@repo/schemas/errors";

const MySchema = z.object({
  id: z.string(),
  ...timestampFields, // adds createdAt, updatedAt
});
```

### Refinements

```typescript
// Cross-field validation
const ReviewIssueSchema = z.object({
  file: z.string().nullable(),
  line: z.number().nullable(),
}).refine(
  (data) => !(data.line !== null && data.file === null),
  { message: "Line number requires a file", path: ["line"] }
);
```

## Cross-References

- [Packages: Core](./core.md) - Uses these schemas
- [Features: Review Flow](../features/review-flow.md) - Review schema usage
- [Features: Settings](../features/settings.md) - Settings schema usage
- [Reference: Utilities](../reference/utilities.md) - Validation utilities
