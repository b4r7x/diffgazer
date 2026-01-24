# Workflow 05: Agentic Review Pipeline

## Overview

Enhance the review pipeline with evidence tracking, trace recording, and fix plans.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review using Vercel AI SDK.

### Review Pipeline
```
Collect Material → Triage Pass → Merge/Dedupe → Drilldown (on-demand) → Apply
     (git)          (fast/broad)    (fingerprint)     (deep/focused)     (user)
```

### Key Difference from Chat Agents
- NOT a growing conversation with compaction
- Bounded context per stage
- Evidence/trace recorded for audit trail
- Drilldown only on user request

### Existing Code
- `packages/core/src/review/triage.ts` - Triage implementation
- `packages/core/src/review/drilldown.ts` - Drilldown implementation
- `packages/core/src/review/lenses/` - Lens definitions
- `apps/server/src/services/triage.ts` - Server service

---

## Task 1: Update Triage Prompt for Evidence

**Agent:** `llm-application-dev:ai-engineer`

**File:** `packages/core/src/review/triage.ts`

### Changes:

1. **Update System Prompt**
   ```
   You are a code review expert analyzing a git diff.

   For each issue found, you MUST provide:
   - title: Brief description of the problem
   - severity: blocker|high|medium|low|nit
   - category: correctness|security|performance|api|tests|readability|style
   - symptom: EXACTLY what you observe in the code (quote specific lines)
   - whyItMatters: The specific risk or impact if not fixed
   - recommendation: Concrete action to take
   - fixPlan: Numbered steps to fix (at least 1 step)
   - evidence: References to specific diff hunks you analyzed

   DO NOT provide vague descriptions. Be specific and actionable.
   ```

2. **Update Response Schema**
   ```typescript
   const triageResponseSchema = z.object({
     summary: z.string(),
     issues: z.array(z.object({
       // Existing fields
       id: z.string(),
       severity: triageSeveritySchema,
       category: triageCategorySchema,
       title: z.string(),
       file: z.string(),
       lineStart: z.number().optional(),
       lineEnd: z.number().optional(),
       rationale: z.string(),
       recommendation: z.string(),
       confidence: z.number(),

       // New required fields
       symptom: z.string(),
       whyItMatters: z.string(),
       fixPlan: z.array(fixPlanStepSchema).min(1),
       evidence: z.array(z.object({
         hunkIndex: z.number(), // Reference to diff hunk
         excerpt: z.string(),   // Relevant code excerpt
         note: z.string(),      // Why this is evidence
       })),

       // Optional fields
       betterOptions: z.array(z.string()).optional(),
       testsToAdd: z.array(z.string()).optional(),
     })),
   });
   ```

3. **Add Evidence Extraction**
   ```typescript
   function extractEvidence(
     issue: RawTriageIssue,
     diffHunks: DiffHunk[]
   ): EvidenceRef[] {
     return issue.evidence.map(e => ({
       type: "diffHunk",
       title: `Diff hunk in ${issue.file}`,
       sourceId: `hunk-${e.hunkIndex}`,
       file: issue.file,
       range: diffHunks[e.hunkIndex]?.range,
       excerpt: e.excerpt,
     }));
   }
   ```

4. **Validate Completeness**
   ```typescript
   function validateIssueCompleteness(issue: TriageIssue): boolean {
     return (
       issue.symptom?.length > 0 &&
       issue.whyItMatters?.length > 0 &&
       issue.fixPlan?.length > 0 &&
       issue.evidence?.length > 0
     );
   }
   ```

---

## Task 2: Add Trace Recording to Drilldown

**Agent:** `llm-application-dev:ai-engineer`

**File:** `packages/core/src/review/drilldown.ts`

### Changes:

1. **Create Tool Wrappers**
   ```typescript
   interface TraceRecorder {
     traces: TraceRef[];
     wrap<T>(tool: string, fn: () => Promise<T>, inputSummary: string): Promise<T>;
   }

   function createTraceRecorder(): TraceRecorder {
     const traces: TraceRef[] = [];
     let step = 0;

     return {
       traces,
       async wrap(tool, fn, inputSummary) {
         step++;
         const startTime = Date.now();
         const result = await fn();
         traces.push({
           step,
           tool,
           inputSummary,
           outputSummary: summarizeOutput(result),
           timestamp: new Date().toISOString(),
         });
         return result;
       },
     };
   }
   ```

2. **Update Drilldown Function**
   ```typescript
   export async function drilldownIssue(
     issue: TriageIssue,
     context: DrilldownContext
   ): Promise<DrilldownResult> {
     const recorder = createTraceRecorder();

     // Read file context with tracing
     const fileContent = await recorder.wrap(
       "readFileRange",
       () => readFileRange(issue.file, issue.lineStart - 20, issue.lineEnd + 20),
       `${issue.file}:${issue.lineStart}-${issue.lineEnd}`
     );

     // Search for related code if needed
     if (issue.needsMoreContext) {
       const searchResults = await recorder.wrap(
         "repoSearch",
         () => repoSearch(extractKeyTerms(issue)),
         `search: ${extractKeyTerms(issue).join(", ")}`
       );
     }

     // Generate enhanced issue with AI
     const enhanced = await generateEnhancedIssue(issue, fileContent, searchResults);

     return {
       ...enhanced,
       trace: recorder.traces,
     };
   }
   ```

3. **Add Output Summarization**
   ```typescript
   function summarizeOutput(result: unknown): string {
     if (typeof result === "string") {
       return `${result.split("\n").length} lines`;
     }
     if (Array.isArray(result)) {
       return `${result.length} items`;
     }
     return "completed";
   }
   ```

---

## Task 3: Implement Fingerprinting Algorithm

**Agent:** `backend-development:backend-architect`

**File:** `packages/core/src/review/fingerprint.ts` (new)

### Implementation:

```typescript
import { createHash } from "crypto";
import type { TriageIssue } from "@repo/schemas";

// Normalize title for fingerprinting
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove special chars
    .replace(/\b(the|a|an|is|are|was|were|be|been|being)\b/g, "") // Remove stop words
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

// Extract digest from diff hunk
function getHunkDigest(hunk: string): string {
  const normalized = hunk
    .replace(/^\s+/gm, "") // Remove leading whitespace
    .replace(/\/\/.*$/gm, "") // Remove comments
    .substring(0, 400); // Limit length
  return createHash("sha1").update(normalized).digest("hex").substring(0, 16);
}

// Generate fingerprint for issue
export function generateFingerprint(issue: TriageIssue, diffHunk?: string): string {
  const lineBucket = Math.floor((issue.lineStart ?? 0) / 5);

  const components = [
    issue.file,
    lineBucket.toString(),
    issue.category,
    normalizeTitle(issue.title),
  ];

  if (diffHunk) {
    components.push(getHunkDigest(diffHunk));
  }

  return createHash("sha256")
    .update(components.join(":"))
    .digest("hex")
    .substring(0, 32);
}

// Merge duplicate issues
export function mergeIssues(issues: TriageIssue[]): TriageIssue[] {
  const byFingerprint = new Map<string, TriageIssue[]>();

  for (const issue of issues) {
    const fp = issue.fingerprint ?? generateFingerprint(issue);
    const existing = byFingerprint.get(fp) ?? [];
    existing.push(issue);
    byFingerprint.set(fp, existing);
  }

  return Array.from(byFingerprint.values()).map(group => {
    if (group.length === 1) return group[0];

    // Merge strategy
    const primary = group[0];
    return {
      ...primary,
      severity: maxSeverity(group.map(i => i.severity)),
      confidence: Math.max(...group.map(i => i.confidence)),
      lens: primary.lens, // Keep primary lens
      lenses: [...new Set(group.map(i => i.lens))], // Track all lenses
      betterOptions: mergeBetterOptions(group),
    };
  });
}

const SEVERITY_ORDER = ["nit", "low", "medium", "high", "blocker"];
function maxSeverity(severities: string[]): string {
  return severities.reduce((max, s) =>
    SEVERITY_ORDER.indexOf(s) > SEVERITY_ORDER.indexOf(max) ? s : max
  );
}
```

---

## Task 4: Session Event Recording Hook

**Agent:** `react-component-architect`

**File:** `apps/cli/src/hooks/use-session-recorder.ts`

### Implementation:

```typescript
import { useCallback, useRef, useEffect } from "react";
import { appendEvent, createSession } from "@repo/core/storage";
import type { SessionEvent, SessionEventType } from "@repo/schemas";

interface SessionRecorderOptions {
  projectId: string;
  enabled?: boolean;
}

export function useSessionRecorder(options: SessionRecorderOptions) {
  const { projectId, enabled = true } = options;
  const sessionIdRef = useRef<string | null>(null);

  // Initialize session on mount
  useEffect(() => {
    if (!enabled) return;

    const init = async () => {
      const result = await createSession(projectId);
      if (result.ok) {
        sessionIdRef.current = result.value.id;
      }
    };
    init();
  }, [projectId, enabled]);

  // Record an event
  const recordEvent = useCallback(
    async (type: SessionEventType, payload: Record<string, unknown>) => {
      if (!enabled || !sessionIdRef.current) return;

      const event: SessionEvent = {
        ts: new Date().toISOString(),
        type,
        payload,
      };

      await appendEvent(projectId, sessionIdRef.current, event);
    },
    [projectId, enabled]
  );

  // Convenience methods
  const recordNavigation = useCallback(
    (from: string, to: string) => recordEvent("NAVIGATE", { from, to }),
    [recordEvent]
  );

  const recordOpenIssue = useCallback(
    (reviewId: string, issueId: string) =>
      recordEvent("OPEN_ISSUE", { reviewId, issueId }),
    [recordEvent]
  );

  const recordToggleView = useCallback(
    (tab: string) => recordEvent("TOGGLE_VIEW", { tab }),
    [recordEvent]
  );

  const recordApplyPatch = useCallback(
    (reviewId: string, issueId: string) =>
      recordEvent("APPLY_PATCH", { reviewId, issueId }),
    [recordEvent]
  );

  const recordIgnoreIssue = useCallback(
    (reviewId: string, issueId: string) =>
      recordEvent("IGNORE_ISSUE", { reviewId, issueId }),
    [recordEvent]
  );

  const recordFilterChange = useCallback(
    (filters: Record<string, string | undefined>) =>
      recordEvent("FILTER_CHANGED", filters),
    [recordEvent]
  );

  return {
    sessionId: sessionIdRef.current,
    recordEvent,
    recordNavigation,
    recordOpenIssue,
    recordToggleView,
    recordApplyPatch,
    recordIgnoreIssue,
    recordFilterChange,
  };
}
```

---

## Task 5: Integrate Recording into App

**Agent:** `react-component-architect`

**Files:**
- `apps/cli/src/features/app/hooks/use-app-state.ts`
- `apps/cli/src/app/views/review-view.tsx`

### Changes:

1. **Add recorder to app state**
   ```typescript
   const recorder = useSessionRecorder({
     projectId,
     enabled: isConfigured
   });

   // Pass recorder to views via context or props
   ```

2. **Record navigation events**
   ```typescript
   const navigate = (screen: Screen) => {
     recorder.recordNavigation(currentScreen, screen);
     setScreen(screen);
   };
   ```

3. **Record review actions**
   ```typescript
   // In review-view.tsx
   const handleIssueOpen = (issueId: string) => {
     recorder.recordOpenIssue(reviewId, issueId);
     setSelectedIssueId(issueId);
   };

   const handleApply = (issueId: string) => {
     recorder.recordApplyPatch(reviewId, issueId);
     // ... apply logic
   };
   ```

---

## Validation

After completing all tasks:

```bash
npm run type-check
npx vitest run packages/core/src/review/
```

Test the full pipeline:
1. Run triage on a diff
2. Verify issues have symptom, whyItMatters, fixPlan, evidence
3. Open an issue to trigger drilldown
4. Verify trace is recorded
5. Check session events are persisted
