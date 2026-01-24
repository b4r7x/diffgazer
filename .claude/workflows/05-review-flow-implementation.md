# Review Flow Implementation Workflow

## Overview

Implement the full review flow with CLI commands, lenses system, and persistence - aligned with existing Stargazer architecture.

---

## Architecture Alignment

### Persistence
- Store in `.stargazer/` (project-local), NOT ~/.local/share/
- API keys stay in keyring + file fallback (existing)

### CLI
- Menu-based selection (Ink components)
- Separate commands also available
- Interactive mode is primary UX

---

## Phase 1: Data Model Design (Sequential)

### Agent 1: Define Data Structures
```
Design data model aligned with existing schemas:

Location: packages/schemas/src/

1. ReviewRun
   - id: string (hash of diff + config)
   - createdAt: Date
   - scope: 'unstaged' | 'staged' | 'file' | 'branch'
   - files: string[]
   - diffSnapshot: string
   - issues: ReviewIssue[]
   - state: Map<issueId, 'open' | 'ignored' | 'fixed' | 'applied'>

2. Session (if needed for multi-step flows)
   - id: string
   - reviewRunId: string
   - events: SessionEvent[]

3. Lenses
   - id: string
   - name: string
   - systemPrompt: string
   - rubric: SeverityRubric
   - triggers: string[] (file patterns)

Use existing Zod patterns from packages/schemas/
```

---

## Phase 2: Storage Implementation (Sequential)

### Agent 2: Review Storage
```
Implement storage in packages/core/src/storage/:

1. review-storage.ts
   - saveReviewRun()
   - loadReviewRun()
   - listReviewRuns()
   - updateIssueState()

2. Store in .stargazer/reviews/<reviewId>/
   - diff.patch
   - issues.json
   - state.json

3. Use existing storage patterns from packages/core/src/storage/
```

---

## Phase 3: Review Engine (Sequential)

### Agent 3: Triage Engine
```
Implement in packages/core/src/review/:

1. triage.ts
   - triageReview(diff, lenses, projectContext)
   - Returns TriageResult with issues[]
   - Uses AI SDK structured output

2. Multi-lens support:
   - Run lenses in parallel
   - Merge/dedupe results
   - Fingerprint: hash(file + lineRange + normalizedTitle)
```

### Agent 4: Drilldown Engine
```
Implement in packages/core/src/review/:

1. drilldown.ts
   - drilldownIssue(issue, context)
   - Adds file context, type definitions
   - Returns detailed issue + patch suggestion

2. Tools for agent loop:
   - readFileRange()
   - searchRepo()
   - getTypeDefs()
```

### Agent 5: Lenses System
```
Implement lenses:

1. Built-in lenses in packages/core/src/review/lenses/:
   - correctness.ts
   - security.ts
   - performance.ts
   - simplicity.ts
   - tests.ts
   - api-design.ts

2. Each lens exports:
   - id, name, description
   - systemPrompt
   - severityRubric
   - fileTriggers (patterns that auto-enable lens)

3. Profiles (preset combinations):
   - quick: correctness only, high severity
   - strict: correctness + security + tests + style
   - perf: correctness + performance
   - security: security focused
```

---

## Phase 4: CLI Commands (Parallel)

### Agent 6: Review Command
```
Implement in apps/cli/src/commands/:

1. review.ts (main entry)
   - ai-review → unstaged, default lenses
   - ai-review --staged
   - ai-review --files <paths>
   - ai-review --lens <names>
   - ai-review --profile <name>
   - ai-review --depth triage|balanced|deep

2. Integrate with CLI menu (Ink)
```

### Agent 7: Issue Navigation Commands
```
Implement issue navigation:

1. In review screen or commands:
   - next → show next issue
   - open <id> → full detail + drilldown
   - apply <id> → apply suggested patch
   - ignore <id> → mark ignored
   - export → markdown output

2. Use Ink for interactive display
```

### Agent 8: Interactive Pick Command
```
Implement interactive mode:

1. ai-review pick
   - Show changed files (multi-select)
   - Show available lenses (multi-select)
   - Show depth options
   - Run review with selections

2. Use Ink SelectInput, MultiSelect components
```

---

## Phase 5: CLI Screens (Sequential)

### Agent 9: Review Screen
```
Implement in apps/cli/src/app/screens/:

1. review-screen.tsx
   - Shows issue list with severity colors
   - Keyboard navigation (j/k, enter, i for ignore)
   - Inline diff preview
   - Status bar with counts

2. review-detail-screen.tsx
   - Full issue detail
   - Suggested patch with syntax highlighting
   - Apply/ignore/skip actions
```

### Agent 10: Menu Integration
```
Update CLI menu:

1. Add review options to main menu
2. Options:
   - Review unstaged changes
   - Review staged changes
   - Review specific files
   - View past reviews
   - Configure lenses
```

---

## Phase 6: Validation (Parallel)

### Agent 11: Type Check & Tests
```
Validate implementation:

1. npm run type-check
2. Write tests for:
   - Triage engine
   - Drilldown engine
   - Storage operations
   - CLI commands

3. npx vitest run
```

### Agent 12: Integration Test
```
Manual integration test:

1. Create test changes in repo
2. Run ai-review
3. Navigate issues
4. Apply a patch
5. Verify state persistence
```

---

## Expected Output

1. **Schemas**: ReviewRun, Lenses in packages/schemas/
2. **Storage**: Review persistence in packages/core/
3. **Engine**: Triage, drilldown, lenses in packages/core/
4. **CLI**: Commands and screens in apps/cli/
5. **Tests**: Coverage for new functionality

---

## CLI Commands Summary

| Command | Description |
|---------|-------------|
| `ai-review` | Review unstaged changes |
| `ai-review --staged` | Review staged changes |
| `ai-review --files <paths>` | Review specific files |
| `ai-review pick` | Interactive selection |
| `ai-review --lens <names>` | Use specific lenses |
| `ai-review --profile <name>` | Use preset profile |
| `ai-review resume <id>` | Resume past review |
| `ai-review list` | List past reviews |

---

## Constraints

- CLI is primary interface (menu-based)
- Persistence in `.stargazer/` (project-local)
- API keys stay in keyring + file fallback
- Use existing patterns (Result<T,E>, Zod, etc.)
- Follow Bulletproof React in CLI
- Follow Bulletproof Node.js in server
