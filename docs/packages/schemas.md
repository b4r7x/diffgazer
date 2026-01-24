# @repo/schemas

Canonical type definitions using Zod. All shared types should be defined here using Zod schemas, then exported as TypeScript types via `z.infer<>`.

## Installation

```typescript
import { ReviewResultSchema, type ReviewResult } from "@repo/schemas/review";
import { UserConfigSchema, type UserConfig } from "@repo/schemas/config";
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

### Review Schemas

```typescript
import {
  ReviewSeveritySchema,
  ReviewCategorySchema,
  ReviewIssueSchema,
  ReviewResultSchema,
  ReviewStreamEventSchema,
  type ReviewSeverity,
  type ReviewCategory,
  type ReviewIssue,
  type ReviewResult,
  type ReviewStreamEvent,
} from "@repo/schemas/review";
```

#### Severity Levels

```typescript
export const REVIEW_SEVERITY = ["critical", "warning", "suggestion", "nitpick"] as const;
```

| Severity | Description | Action |
|----------|-------------|--------|
| `critical` | Must fix before merge | Block PR |
| `warning` | Should address | Review required |
| `suggestion` | Nice to have | Optional |
| `nitpick` | Minor style | Informational |

#### Categories

```typescript
export const REVIEW_CATEGORY = [
  "security",
  "performance",
  "style",
  "logic",
  "documentation",
  "best-practice"
] as const;
```

#### ReviewIssue

```typescript
const ReviewIssueSchema = z.object({
  severity: ReviewSeveritySchema,
  category: ReviewCategorySchema,
  file: z.string().nullable(),
  line: z.number().nullable(),
  title: z.string(),
  description: z.string(),
  suggestion: z.string().nullable(),
});
```

#### ReviewResult

```typescript
const ReviewResultSchema = z.object({
  summary: z.string(),
  issues: z.array(ReviewIssueSchema),
  overallScore: z.number().min(0).max(10).nullable(),
});
```

#### Stream Events

```typescript
const ReviewStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chunk"), content: z.string() }),
  z.object({ type: z.literal("complete"), result: ReviewResultSchema }),
  z.object({ type: z.literal("error"), error: ReviewErrorSchema }),
]);
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
  type AIProvider,
  type UserConfig,
  type GeminiModel,
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

#### UserConfig

```typescript
const UserConfigSchema = z.object({
  provider: AIProviderSchema,
  model: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

### Session Schemas

```typescript
import {
  SessionSchema,
  CreateSessionRequestSchema,
  type Session,
} from "@repo/schemas/session";
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
export const REVIEW_SPECIFIC_CODES = ["NO_DIFF", "AI_ERROR"] as const;
export const REVIEW_ERROR_CODES = createDomainErrorCodes(REVIEW_SPECIFIC_CODES);
// ["VALIDATION_ERROR", "NOT_FOUND", "INTERNAL_ERROR", "RATE_LIMITED", "API_KEY_MISSING", "NO_DIFF", "AI_ERROR"]
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

### Stream Event Schema Factory

```typescript
import { createStreamEventSchema } from "@repo/schemas/errors";

const MyStreamEventSchema = createStreamEventSchema(
  { result: MyResultSchema },  // complete event payload
  MyErrorSchema                 // error schema
);
// Creates: chunk | complete | error discriminated union
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
- [Reference: Utilities](../reference/utilities.md) - Validation utilities
