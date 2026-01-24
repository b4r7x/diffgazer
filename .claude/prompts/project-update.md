# /project-update - Update Project Documentation for AI

## Purpose

Updates project documentation so future AI sessions can quickly understand the codebase. Run this after significant changes.

---

## Execution

Use Task tool with subagent_type: "documentation-specialist"

Prompt:
```
Update Stargazer project documentation for AI consumption.

## What to Update

### 1. CLAUDE.md (Primary AI Context)
Location: /Users/voitz/Projects/stargazer/CLAUDE.md

This is the FIRST thing AI reads. Keep it:
- Concise (fits in context window)
- Current (reflects actual state)
- Actionable (tells AI what to do/not do)

Update sections:
- Project Overview (if changed)
- Tech Stack (if dependencies changed)
- Essential Commands
- Architecture Decisions (if new ADRs)
- Patterns to Preserve
- Shared Utilities (if new ones added)

### 2. Architecture Overview
Location: /Users/voitz/Projects/stargazer/docs/architecture/overview.md

Update:
- Component diagram (if structure changed)
- Data flow (if new flows added)
- Key decisions summary

### 3. Feature Documentation
Location: /Users/voitz/Projects/stargazer/docs/features/

For each major feature, ensure docs exist:
- review-flow.md
- ai-integration.md
- lenses.md
- Add new feature docs if features were added

### 4. CLI Commands Reference
Location: /Users/voitz/Projects/stargazer/docs/reference/cli-commands.md

Update with any new commands or changed options.

### 5. API Endpoints Reference
Location: /Users/voitz/Projects/stargazer/docs/reference/api-endpoints.md

Update with any new routes.

## How to Update

1. Read current state of each file
2. Explore codebase for changes:
   - git log --oneline -20 (recent commits)
   - Check packages/*/src/ for new modules
   - Check apps/*/src/ for new features
3. Update docs to reflect current reality
4. Keep format AI-readable:
   - Clear headers
   - Tables for quick reference
   - Code examples where helpful

## Output

Report what was updated:
- Files modified
- Key changes documented
- Any gaps still remaining
```

---

## When to Run

- After implementing new features
- After major refactoring
- After adding new packages/modules
- Weekly maintenance
- Before sharing project with others

---

## AI-Readable Format Guidelines

### Good (AI can parse quickly):
```markdown
## Feature: Review Engine

**Location:** `packages/core/src/review/`

**Key Files:**
| File | Purpose |
|------|---------|
| triage.ts | Initial review pass |
| drilldown.ts | Deep issue analysis |

**Usage:**
\`\`\`typescript
import { triageReview } from '@repo/core/review';
const result = await triageReview(diff, lenses, client);
\`\`\`
```

### Bad (AI struggles):
```markdown
The review engine is located in the core package and contains
various files for different purposes. The triage file handles
the initial pass while drilldown does deeper analysis...
```
