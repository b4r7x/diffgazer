# Vercel AI SDK Migration Workflow

## Overview

Migrate from current AI provider implementation to Vercel AI SDK for unified provider interface, structured outputs, and better tooling.

---

## Why Migrate

From gpt-convo.md analysis:
- Unified interface to providers (OpenAI, Anthropic, Google/Gemini)
- Built-in structured output (JSON Schema)
- Tool calling with proper typing
- Retry logic, streaming, validation built-in
- Agent loop support

---

## Phase 1: Current State Analysis (Sequential)

### Agent 1: AI Implementation Audit
```
Analyze current AI implementation:

Location: packages/core/src/ai/

Document:
1. Current provider abstraction
2. How JSON output is handled
3. Streaming implementation
4. Error handling patterns
5. What works well (preserve)
6. Pain points (fix)

Also check:
- apps/server/src/providers/
- apps/server/src/services/ (AI-related)
```

### Agent 2: AI SDK Research
```
Research Vercel AI SDK (latest):

1. Provider setup (Google, OpenAI, Anthropic)
2. generateObject() for structured output
3. streamObject() for streaming structured output
4. Tool definitions and calling
5. Error handling and retries
6. Best practices for multi-provider setup
```

---

## Phase 2: Migration Plan (Sequential)

### Agent 3: Design New Architecture
```
Design AI SDK integration:

1. Provider configuration
   - Keep keyring/file fallback for API keys
   - Provider selection UI in CLI
   - Per-provider settings

2. Structured output schemas
   - Review issues schema (from gpt-convo.md)
   - Use existing Zod schemas where possible

3. Tool definitions (for agent loop)
   - getDiff()
   - readFileRange()
   - repoSearch()
   - applyPatch()

4. Integration points
   - Where AI SDK fits in current architecture
   - What to replace vs wrap
```

---

## Phase 3: Implementation (Sequential - Order Matters)

### Agent 4: Core AI Module Refactor
```
Refactor packages/core/src/ai/:

1. Create AI SDK wrapper that:
   - Handles provider initialization
   - Manages API keys (from keyring/file)
   - Provides unified interface

2. Implement structured output:
   - ReviewIssueSchema
   - TriageResultSchema
   - DrilldownResultSchema

3. Keep Result<T, E> pattern for errors
```

### Agent 5: Server Provider Updates
```
Update apps/server/src/providers/:

1. Replace/update provider implementations
2. Use AI SDK for actual calls
3. Keep abstraction layer for future providers
4. Maintain responseSchema pattern (ADR-0005)
```

### Agent 6: Service Integration
```
Update apps/server/src/services/:

1. Update review-service to use new AI module
2. Implement 3-stage flow:
   - Stage A: Collect diff (deterministic)
   - Stage B: Triage pass (fast)
   - Stage C: Drilldown pass (on-demand)

3. Keep streaming support via SSE
```

---

## Phase 4: Validation (Parallel)

### Agent 7: Type Check & Tests
```
Validate migration:

1. npm run type-check
2. npx vitest run
3. Manual test with each provider
```

### Agent 8: Code Review
```
Run code-reviewer on changes:

1. Check for security issues
2. Verify error handling
3. Confirm patterns preserved
```

---

## Expected Output

1. **Migration Report**: What changed, what preserved
2. **New AI Module**: AI SDK integration in core
3. **Updated Providers**: Server provider implementations
4. **Updated Services**: Review service with 3-stage flow
5. **Validation**: All tests pass, type-check passes

---

## Constraints

- Keep API key storage as-is (keyring + file fallback)
- Keep Result<T, E> error handling
- Keep provider abstraction (ADR-0002)
- Keep responseSchema pattern (ADR-0005)
- Keep XML escaping for prompts (ADR-0004)
- Max 65536 tokens (ADR-0005)

---

## Schemas to Implement

### ReviewIssue (from gpt-convo.md)
```typescript
{
  id: string
  severity: 'blocker' | 'high' | 'medium' | 'low' | 'nit'
  category: 'correctness' | 'security' | 'performance' | 'api' | 'tests' | 'readability' | 'style'
  title: string
  file: string
  line_start?: number
  line_end?: number
  diff_hunk?: string
  rationale: string
  recommendation: string
  suggested_patch?: string
  confidence: number // 0-1
}
```

### TriageResult
```typescript
{
  summary: string
  issues: ReviewIssue[]
}
```
