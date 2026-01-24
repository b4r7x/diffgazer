# Workflow 01: Schemas & Data Models

## Overview

Implement all data models and Zod schemas needed for the UI system.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review. TypeScript monorepo with:
- `packages/schemas/` - Canonical Zod schemas (LEAF PACKAGE)
- `packages/core/` - Business logic
- `apps/cli/` - React Ink CLI
- `apps/server/` - Hono backend

### Patterns to Follow
- All schemas use Zod
- Export types with `z.infer<typeof Schema>`
- Use `z.object()` for objects, `z.enum()` for enums
- Naming: PascalCase for types, camelCase for schema variables

---

## Task 1: Settings & Trust Schemas

**Agent:** `backend-development:backend-architect`

**File:** `packages/schemas/src/settings.ts`

```typescript
import { z } from "zod";

// Trust capabilities
export const trustCapabilitiesSchema = z.object({
  readFiles: z.boolean(),
  readGit: z.boolean(),
  runCommands: z.boolean(),
});
export type TrustCapabilities = z.infer<typeof trustCapabilitiesSchema>;

// Trust mode
export const trustModeSchema = z.enum(["persistent", "session"]);
export type TrustMode = z.infer<typeof trustModeSchema>;

// Full trust config
export const trustConfigSchema = z.object({
  projectId: z.string(),
  repoRoot: z.string(),
  trustedAt: z.string(), // ISO 8601
  capabilities: trustCapabilitiesSchema,
  trustMode: trustModeSchema,
});
export type TrustConfig = z.infer<typeof trustConfigSchema>;

// Theme options
export const themeSchema = z.enum(["auto", "dark", "light", "terminal"]);
export type Theme = z.infer<typeof themeSchema>;

// Controls mode
export const controlsModeSchema = z.enum(["menu", "keys"]);
export type ControlsMode = z.infer<typeof controlsModeSchema>;

// Full settings
export const settingsConfigSchema = z.object({
  theme: themeSchema,
  controlsMode: controlsModeSchema,
  defaultLenses: z.array(z.string()).default(["correctness"]),
  defaultProfile: z.string().default("quick"),
  severityThreshold: z.enum(["blocker", "high", "medium", "low", "nit"]).default("medium"),
});
export type SettingsConfig = z.infer<typeof settingsConfigSchema>;
```

**Update:** `packages/schemas/src/index.ts` - add exports

---

## Task 2: Enhanced Issue Schema

**Agent:** `backend-development:backend-architect`

**File:** Update `packages/schemas/src/triage.ts`

Add these types:

```typescript
// Evidence reference
export const evidenceRefSchema = z.object({
  type: z.enum(["diffHunk", "fileSnippet", "repoSearch", "commandOutput"]),
  title: z.string(),
  sourceId: z.string(),
  file: z.string().optional(),
  range: z.object({
    startLine: z.number(),
    endLine: z.number(),
  }).optional(),
  excerpt: z.string(),
  sha: z.string().optional(),
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

// Trace reference
export const traceRefSchema = z.object({
  step: z.number(),
  tool: z.string(),
  inputSummary: z.string(),
  outputSummary: z.string(),
  timestamp: z.string(), // ISO 8601
  artifacts: z.array(z.string()).optional(),
});
export type TraceRef = z.infer<typeof traceRefSchema>;

// Fix plan step
export const fixPlanStepSchema = z.object({
  step: z.number(),
  action: z.string(),
  files: z.array(z.string()).optional(),
  risk: z.enum(["low", "med", "high"]).optional(),
});
export type FixPlanStep = z.infer<typeof fixPlanStepSchema>;

// Enhanced issue (extend existing TriageIssue)
// Add these fields to existing schema:
symptom: z.string(), // What is observed
whyItMatters: z.string(), // Risk/impact
fixPlan: z.array(fixPlanStepSchema).optional(),
betterOptions: z.array(z.string()).optional(),
testsToAdd: z.array(z.string()).optional(),
evidence: z.array(evidenceRefSchema).default([]),
trace: z.array(traceRefSchema).optional(),
```

---

## Task 3: Session Event Schema

**Agent:** `backend-development:backend-architect`

**File:** Update `packages/schemas/src/session.ts`

Add these types:

```typescript
// Session event types
export const sessionEventTypeSchema = z.enum([
  "NAVIGATE",
  "OPEN_ISSUE",
  "TOGGLE_VIEW",
  "APPLY_PATCH",
  "IGNORE_ISSUE",
  "FILTER_CHANGED",
  "RUN_CREATED",
  "RUN_RESUMED",
  "SETTINGS_CHANGED",
]);
export type SessionEventType = z.infer<typeof sessionEventTypeSchema>;

// Generic session event
export const sessionEventSchema = z.object({
  ts: z.string(), // ISO 8601
  type: sessionEventTypeSchema,
  payload: z.record(z.unknown()),
});
export type SessionEvent = z.infer<typeof sessionEventSchema>;

// Specific payload schemas for type safety
export const navigatePayloadSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const openIssuePayloadSchema = z.object({
  reviewId: z.string(),
  issueId: z.string(),
});

export const toggleViewPayloadSchema = z.object({
  tab: z.enum(["details", "explain", "trace", "patch"]),
});

export const filterChangedPayloadSchema = z.object({
  severity: z.string().optional(),
  lens: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});
```

---

## Validation

After completing all tasks:

```bash
npm run type-check
```

Verify no TypeScript errors and all exports are available.
