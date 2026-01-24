# /project-context - Load Project Understanding

## Purpose

Loads full project context before starting work. Run this at the START of a new session to understand the codebase.

---

## Execution

Use Task tool with subagent_type: "code-archaeologist"

Prompt:
```
Analyze Stargazer project and build comprehensive understanding.

## Read Order (Important)

### 1. Primary Context (MUST READ)
- /Users/voitz/Projects/stargazer/CLAUDE.md
- /Users/voitz/Projects/stargazer/docs/architecture/overview.md

### 2. Architecture & Patterns
- /Users/voitz/Projects/stargazer/.claude/docs/patterns.md
- /Users/voitz/Projects/stargazer/.claude/docs/decisions.md
- /Users/voitz/Projects/stargazer/.claude/docs/security.md

### 3. Current Structure
Run: find packages apps -type f -name "*.ts" | head -100
Run: cat package.json (root)

### 4. Key Implementations
Based on what user needs, read relevant:

**For AI/Review work:**
- packages/core/src/ai/sdk-client.ts
- packages/core/src/review/triage.ts
- packages/core/src/review/lenses/index.ts

**For CLI work:**
- apps/cli/src/commands/review.ts
- apps/cli/src/features/review/apps/interactive-review-app.tsx

**For Server work:**
- apps/server/src/api/routes/triage.ts
- apps/server/src/app.ts

**For Schema work:**
- packages/schemas/src/triage.ts
- packages/schemas/src/lens.ts

### 5. Recent Changes
Run: git log --oneline -10
Run: git status

## Output Summary

Provide a brief summary:

### Project Understanding
- What Stargazer does (1 sentence)
- Tech stack
- Key architectural decisions

### Current State
- Recent commits (what changed)
- Any uncommitted changes

### Key Patterns to Follow
- Result<T, E> for errors
- Zod schemas for validation
- Provider abstraction for AI
- Bulletproof React/Node.js structure

### Ready to Work On
Based on codebase state, suggest what might need attention.
```

---

## When to Run

- Start of every new Claude Code session
- When switching to unfamiliar part of codebase
- After pulling changes from remote
- When onboarding to project

---

## Quick Context (Alternative)

If you need faster context without full analysis, just read:

```
Read these files in order:
1. /Users/voitz/Projects/stargazer/CLAUDE.md
2. /Users/voitz/Projects/stargazer/docs/architecture/overview.md
3. git log --oneline -5
4. git status
```

This gives ~80% of needed context in seconds.
