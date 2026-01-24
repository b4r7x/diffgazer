# Master Orchestrator - Self-Contained Workflow

## Overview

Execute all Stargazer improvement workflows using specialized agents. This prompt is **self-contained** - paste it into an empty Claude Code session.

---

## Project Context (Required for Agents)

### What is Stargazer
Local-only CLI tool for AI-powered code review. Server binds to 127.0.0.1 only.

### Tech Stack
TypeScript, React 19 (Ink for CLI), Hono (server), Zod, Vitest

### Monorepo Structure
```
packages/
├── core/       # Shared business logic, Result type, utilities
├── schemas/    # Zod schemas (canonical types) - LEAF PACKAGE
├── api/        # API client - LEAF PACKAGE
apps/
├── server/     # Hono backend (localhost only)
├── cli/        # React Ink CLI (primary interface)
```

### Key Patterns (DO NOT REMOVE)
1. **Result<T, E>** - Use for errors, not exceptions
2. **Provider Abstraction** - AI providers are swappable
3. **CORS Localhost Only** - Security requirement
4. **XML Escaping** - Escape user content in prompts
5. **Zod responseSchema** - For AI JSON output, 65536 max tokens

### Architecture Rules
- Import flow: apps → packages, packages/core → schemas
- schemas and api are leaf packages (no monorepo imports)
- CLI: Bulletproof React (screens/, features/, components/, hooks/)
- Server: Bulletproof Node.js (api/routes/, services/, loaders/)

### What We're Building (from requirements)
1. **AI SDK Migration** - Switch to Vercel AI SDK for unified providers
2. **Review Queue System** - Issues list with next/open/apply/ignore
3. **3-Stage Flow** - Collect → Triage → Drilldown
4. **Lenses System** - correctness, security, performance, simplicity
5. **CLI Commands** - Menu-based + separate commands
6. **Persistence** - Store in `.stargazer/` folder (project-local)
7. **API Keys** - Keep keyring + file fallback (existing)

---

## Execution Instructions

Run this in empty Claude Code session. Use Task tool with specified subagent_type for each agent.

---

## PHASE 1: Structure Audit (PARALLEL)

Launch these 3 agents simultaneously using Task tool:

### Agent 1: Package Structure Audit
```
subagent_type: "javascript-typescript:typescript-pro"

Task: Analyze and improve packages/ structure.

Context:
- packages/core/src/ - shared business logic
- packages/schemas/src/ - Zod schemas (leaf package)
- packages/api/src/ - API client (leaf package)

Steps:
1. Read all files in packages/core/src/, packages/schemas/src/, packages/api/src/
2. Web search: "zustand file structure", "vercel ai sdk structure", "trpc monorepo structure"
3. Compare current structure with OSS best practices
4. Identify: misplaced files, missing organization, dead code
5. Propose changes that respect import boundaries
6. Apply refactoring using Edit tool
7. Run: npm run type-check

Output: List of changes made + any issues found
```

### Agent 2: CLI Bulletproof Verification
```
subagent_type: "react-component-architect"

Task: Verify apps/cli follows Bulletproof React structure.

Expected structure:
apps/cli/src/
├── index.ts           # Entry
├── app/screens/       # TUI screens
├── commands/          # Commander handlers
├── components/        # Shared Ink components
├── features/          # Feature modules with api/, components/, hooks/, index.ts
├── hooks/             # Shared hooks
├── lib/               # Utilities
├── stores/            # Zustand stores
└── types/

Rules:
- screens/ not pages/
- Feature-specific code in features/[name]/
- Shared code in root components/, hooks/
- Tests grouped with source (.test.ts next to .ts)
- Unidirectional: shared → features → app

Steps:
1. Read apps/cli/src/ structure
2. Compare against expected structure
3. Identify misplaced files
4. Move files to correct locations using Write/Edit
5. Update imports
6. Run: npm run type-check

Output: Compliance report + changes made
```

### Agent 3: Server Bulletproof Verification
```
subagent_type: "backend-development:backend-architect"

Task: Verify apps/server follows Bulletproof Node.js + Hono patterns.

Expected structure:
apps/server/src/
├── index.ts           # Entry: export createServer
├── app.ts             # Hono app factory
├── api/routes/        # Route handlers (thin, HTTP only)
├── api/middleware/    # Cross-cutting concerns
├── config/            # Configuration
├── loaders/           # Bootstrap functions
├── services/          # Business logic (no HTTP knowledge)
├── providers/         # AI provider adapters
├── storage/           # File persistence
└── secrets/           # Keyring + vault

Rules:
- Routes: HTTP only, call services, return responses
- Services: Business logic, return Result<T, E>
- No business logic in routes
- Loaders initialize dependencies at startup

Steps:
1. Read apps/server/src/ structure
2. Web search: "Hono best practices 2025", "bulletproof nodejs structure"
3. Compare current vs expected
4. Extract any business logic from routes to services
5. Apply changes using Edit tool
6. Run: npm run type-check

Output: Compliance report + changes made
```

Wait for all 3 agents to complete before Phase 2.

---

## PHASE 2: AI SDK Migration (SEQUENTIAL)

### Agent 4: AI SDK Migration
```
subagent_type: "llm-application-dev:ai-engineer"

Task: Migrate to Vercel AI SDK.

Current state:
- AI code in packages/core/src/ai/
- Provider implementations in apps/server/src/providers/
- Uses custom JSON parsing

Target state:
- Vercel AI SDK for unified provider interface
- generateObject() for structured JSON output
- Tool definitions for agent loop
- Keep keyring + file fallback for API keys
- Keep Result<T, E> error handling

Schemas to implement:
```typescript
// ReviewIssue
{
  id: string
  severity: 'blocker' | 'high' | 'medium' | 'low' | 'nit'
  category: 'correctness' | 'security' | 'performance' | 'api' | 'tests' | 'readability' | 'style'
  title: string
  file: string
  line_start?: number
  line_end?: number
  rationale: string
  recommendation: string
  suggested_patch?: string
  confidence: number // 0-1
}

// TriageResult
{
  summary: string
  issues: ReviewIssue[]
}
```

Steps:
1. Read current AI implementation in packages/core/src/ai/
2. Read apps/server/src/providers/
3. Web search: "Vercel AI SDK generateObject", "AI SDK multi provider setup"
4. Install: npm install ai @ai-sdk/google @ai-sdk/openai @ai-sdk/anthropic
5. Create new AI module using AI SDK
6. Update providers to use AI SDK
7. Add ReviewIssue, TriageResult schemas to packages/schemas/src/
8. Keep existing patterns (Result<T,E>, XML escaping, provider abstraction)
9. Run: npm run type-check && npx vitest run

Output: Migration complete, list of changed files
```

Wait for Agent 4 to complete before Phase 3.

---

## PHASE 3: Review Flow Implementation (SEQUENTIAL)

### Agent 5: Review Engine Core
```
subagent_type: "backend-development:backend-architect"

Task: Implement review engine in packages/core.

Create in packages/core/src/review/:
1. triage.ts - triageReview(diff, lenses, context) → TriageResult
2. drilldown.ts - drilldownIssue(issue) → detailed issue + patch
3. lenses/index.ts - lens definitions

Built-in lenses:
- correctness: logic errors, edge cases
- security: vulnerabilities, auth issues
- performance: bottlenecks, inefficiencies
- simplicity: over-engineering, dead code
- tests: missing coverage

Each lens has: id, name, systemPrompt, severityRubric

Profiles (preset combinations):
- quick: correctness only, high+ severity
- strict: correctness + security + tests
- perf: correctness + performance
- security: security focused

Storage in packages/core/src/storage/:
- review-storage.ts: save/load/list ReviewRuns
- Store in .stargazer/reviews/<id>/

Steps:
1. Create packages/core/src/review/ directory
2. Implement triage.ts using AI SDK from Phase 2
3. Implement drilldown.ts
4. Create 5 built-in lenses
5. Implement review-storage.ts
6. Add tests
7. Run: npm run type-check && npx vitest run

Output: Review engine complete
```

### Agent 6: CLI Review Commands
```
subagent_type: "react-component-architect"

Task: Implement review CLI commands and screens.

Commands in apps/cli/src/commands/:
- review.ts: main entry (ai-review, --staged, --files, --lens, --profile)

Screens in apps/cli/src/app/screens/:
- review-screen.tsx: issue list with navigation
- review-detail-screen.tsx: single issue detail + patch

Features:
- Menu-based selection (primary UX)
- Keyboard nav: j/k navigate, enter open, i ignore, a apply
- Severity colors
- Inline diff preview

CLI Commands:
| Command | Description |
|---------|-------------|
| ai-review | Review unstaged |
| ai-review --staged | Review staged |
| ai-review --files <paths> | Review files |
| ai-review pick | Interactive selection |
| ai-review --lens <names> | Specific lenses |
| ai-review --profile <name> | Use profile |
| ai-review list | Past reviews |
| ai-review resume <id> | Resume review |

Issue navigation (in review screen):
- next: show next issue
- open <id>: full detail + drilldown
- apply <id>: apply patch
- ignore <id>: mark ignored
- export: markdown output

Steps:
1. Create apps/cli/src/commands/review.ts
2. Create apps/cli/src/app/screens/review-screen.tsx
3. Create apps/cli/src/app/screens/review-detail-screen.tsx
4. Add to CLI menu
5. Wire up to review engine from packages/core
6. Add keyboard shortcuts
7. Run: npm run type-check

Output: CLI review system complete
```

---

## PHASE 4: Documentation (PARALLEL with Phase 3)

### Agent 7: Documentation Generator
```
subagent_type: "documentation-specialist"

Task: Generate comprehensive /docs structure.

Create:
/docs/
├── README.md                    # Navigation
├── architecture/
│   ├── overview.md              # High-level
│   ├── monorepo-structure.md    # Packages
│   └── data-flow.md             # Request flow
├── packages/
│   ├── core.md
│   ├── schemas.md
│   └── api.md
├── apps/
│   ├── cli.md
│   └── server.md
├── features/
│   ├── review-flow.md
│   ├── ai-integration.md
│   └── lenses.md
├── guides/
│   ├── getting-started.md
│   ├── adding-features.md
│   └── adding-lenses.md
└── reference/
    ├── cli-commands.md
    └── utilities.md

Format for AI readability:
- Clear headers
- Purpose section first
- Code examples
- Cross-references

Steps:
1. Read existing /docs/ and /.claude/docs/
2. Read CLAUDE.md
3. Create documentation structure
4. Write each doc file
5. Update CLAUDE.md to reference /docs/

Output: Complete documentation
```

---

## PHASE 5: Validation (FINAL)

### Agent 8: Final Validation
```
subagent_type: "code-reviewer"

Task: Validate all changes.

Steps:
1. Run: npm run type-check
2. Run: npx vitest run
3. Review changes for:
   - Security issues
   - Pattern violations
   - Missing error handling
4. Report any critical issues

Output: Validation report
```

---

## Summary

After all phases complete, the system should have:
1. ✅ Cleaned package structure
2. ✅ Bulletproof CLI structure
3. ✅ Bulletproof server structure
4. ✅ Vercel AI SDK integration
5. ✅ Review engine with lenses
6. ✅ CLI review commands and screens
7. ✅ Comprehensive documentation
8. ✅ All tests passing
