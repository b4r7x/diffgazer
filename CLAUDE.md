# Stargazer - Claude Code Context

## Project Overview

Stargazer is a local-only CLI tool for AI-powered code review. Server binds to `127.0.0.1` only.

**Tech Stack:** TypeScript, React 19, Hono, Zod, Vitest, Vercel AI SDK

**Monorepo Structure:**
```
packages/
├── core/       # Shared business logic, utilities, Result type
├── schemas/    # Zod schemas and types (canonical type definitions)
├── api/        # API client (bulletproof fetch pattern)
apps/
├── server/     # Hono backend (localhost only)
├── cli/        # React Ink CLI
```

## Essential Commands

```bash
npm run type-check           # TypeScript validation
npm run build                # Build all packages
npx vitest run               # Run unit tests
npx vitest run <file>        # Run specific test file
./scripts/test-integration.sh # Run integration tests (full flow)
```

## Specialized Agents & Skills (MANDATORY)

**ALWAYS delegate to specialized agents to preserve main context. Never use basic agents when specialized exist.**

### Workflow

1. **Identify** - Match task to best specialized agent/skill
2. **Load skill** - For workflows, invoke `/skill-name` first
3. **Spawn agent** - `Task(specialized-agent)` with clear prompt
4. **Execute** - Agent works autonomously
5. **Summarize** - Return `file:line` + findings only

### Rules

- Main context = planning, coordination, user communication ONLY
- NEVER do deep file reads/searches in main context → delegate to agents
- Run parallel agents when tasks are independent
- Always use most specialized agent available
- Load skills for structured workflows

### Available Specialized Agents

**Feature Development:**
`feature-dev:code-reviewer`, `feature-dev:code-explorer`, `feature-dev:code-architect`

**PR Review Toolkit:**
`pr-review-toolkit:code-reviewer`, `pr-review-toolkit:silent-failure-hunter`, `pr-review-toolkit:code-simplifier`, `pr-review-toolkit:comment-analyzer`, `pr-review-toolkit:pr-test-analyzer`, `pr-review-toolkit:type-design-analyzer`

**JavaScript/TypeScript:**
`javascript-typescript:javascript-pro`, `javascript-typescript:typescript-pro`

**Backend Development:**
`backend-development:backend-architect`, `backend-development:temporal-python-pro`, `backend-development:tdd-orchestrator`, `backend-development:event-sourcing-architect`, `backend-development:graphql-architect`

**Database:**
`database-design:database-architect`, `database-design:sql-pro`

**UI/UX:**
`ui-designer:ui-designer`, `ux-researcher:ux-researcher`

**LLM/AI:**
`llm-application-dev:prompt-engineer`, `llm-application-dev:ai-engineer`, `llm-application-dev:vector-database-engineer`

**Testing:**
`unit-testing:test-automator`, `unit-testing:debugger`, `unit-test-generator:unit-test-generator`

**Code Quality:**
`code-simplifier:code-simplifier`, `code-reviewer:code-reviewer`, `code-review-ai:architect-review`, `codebase-cleanup:code-reviewer`, `codebase-cleanup:test-automator`

**Architecture:**
`code-architect:code-architect`, `backend-architect:backend-architect`, `api-architect`

**API:**
`api-integration-specialist:api-integration-specialist`, `api-tester:api-tester`, `api-testing-observability:api-documenter`, `api-scaffolding:backend-architect`, `api-scaffolding:fastapi-pro`, `api-scaffolding:django-pro`, `api-scaffolding:graphql-architect`

**Performance & Observability:**
`application-performance:performance-engineer`, `application-performance:observability-engineer`, `application-performance:frontend-developer`, `performance-optimizer`

**Security:**
`backend-api-security:backend-architect`, `backend-api-security:backend-security-coder`, `full-stack-orchestration:security-auditor`, `security-scanning:security-auditor`, `security-scanning:threat-modeling-expert`

**Full Stack:**
`full-stack-orchestration:test-automator`, `full-stack-orchestration:performance-engineer`, `full-stack-orchestration:deployment-engineer`

**Context Management:**
`agent-orchestration:context-manager`, `context-management:context-manager`

**Experienced Engineer Specialists:**
`experienced-engineer:performance-engineer`, `experienced-engineer:testing-specialist`, `experienced-engineer:database-architect`, `experienced-engineer:security-specialist`, `experienced-engineer:devops-engineer`, `experienced-engineer:tech-lead`, `experienced-engineer:ux-ui-designer`, `experienced-engineer:code-quality-reviewer`, `experienced-engineer:documentation-writer`, `experienced-engineer:api-architect`

**Frontend:**
`frontend-developer:frontend-developer`, `frontend-developer`, `tailwind-frontend-expert`, `frontend-principles`

**React:**
`react-component-architect`, `react-nextjs-expert`, `react-tanstack-start-expert`, `react-state-manager`, `react-principles`, `nextjs-principles`, `tanstack-start-principles`

**Vue:**
`vue-component-architect`, `vue-nuxt-expert`

**Django:**
`django-api-developer`, `django-backend-expert`, `django-orm-expert`

**Laravel:**
`laravel-backend-expert`, `laravel-eloquent-expert`

**Rails:**
`rails-activerecord-expert`, `rails-api-developer`, `rails-backend-expert`

**Game Dev:**
`game-development:minecraft-bukkit-pro`, `game-development:unity-developer`

**Reverse Engineering:**
`reverse-engineering:malware-analyst`, `reverse-engineering:firmware-analyst`, `reverse-engineering:reverse-engineer`

**SEO:**
`seo-analysis-monitoring:seo-authority-builder`, `seo-analysis-monitoring:seo-cannibalization-detector`, `seo-analysis-monitoring:seo-content-refresher`, `seo-content-creation:seo-content-planner`, `seo-content-creation:seo-content-writer`, `seo-content-creation:seo-content-auditor`, `seo-technical-optimization:seo-structure-architect`, `seo-technical-optimization:seo-meta-optimizer`, `seo-technical-optimization:seo-keyword-strategist`, `seo-technical-optimization:seo-snippet-hunter`

**Shell:**
`shell-scripting:posix-shell-pro`, `shell-scripting:bash-pro`

**Web:**
`web-dev:web-dev`, `web-scripting:ruby-pro`, `web-scripting:php-pro`

**Other Specialized:**
`trend-researcher:trend-researcher`, `vision-specialist:vision-specialist`, `b2b-project-shipper:b2b-project-shipper`, `hookify:conversation-analyzer`

**Top-Level:**
`code-reviewer`, `code-archaeologist`, `performance-optimizer`, `documentation-specialist`, `backend-developer`, `project-analyst`, `team-configurator`, `tech-lead-orchestrator`

### Available Skills (invoke via `/skill-name`)

**API & Backend:**
`/api-scaffolding:fastapi-templates`, `/backend-development:api-design-principles`, `/backend-development:architecture-patterns`, `/backend-development:cqrs-implementation`, `/backend-development:event-store-design`, `/backend-development:microservices-patterns`, `/backend-development:projection-patterns`, `/backend-development:saga-orchestration`, `/backend-development:temporal-python-testing`, `/backend-development:workflow-orchestration-patterns`, `/generate-api-docs:generate-api-docs`

**Audits & Validation:**
`/audit-react`, `/audit:audit`, `/bulletproof-nodejs`, `/bulletproof-react`, `/validate-react-simplification`, `/validate-test-simplification`, `/validate-tests`, `/run-reusability-audit`

**Bug & Debug:**
`/bug-detective:bug-detective`, `/bug-fix:bug-fix`, `/project-debug-stream`

**Code Review:**
`/code-review-assistant:code-review-assistant`, `/code-review:code-review`, `/pr-review-toolkit:review-pr`, `/pr-review:pr-review`

**Database:**
`/database-design:postgresql`

**Discussion & Planning:**
`/discuss:discuss`, `/plan:plan`, `/ultrathink:ultrathink`

**Documentation:**
`/experienced-engineer:code-explain`, `/experienced-engineer:update-claude`, `/project-context`, `/project-structure`, `/project-update`

**Feature Development:**
`/feature-dev:feature-dev`, `/frontend-design:frontend-design`

**Figma:**
`/figma:code-connect-components`, `/figma:create-design-system-rules`, `/figma:implement-design`

**Fixes:**
`/fix-test-types`, `/fix-tests`

**Game Development:**
`/game-development:godot-gdscript-patterns`, `/game-development:unity-ecs-patterns`

**Hookify:**
`/hookify:configure`, `/hookify:help`, `/hookify:hookify`, `/hookify:list`, `/hookify:writing-rules`

**JavaScript/TypeScript:**
`/javascript-testing-patterns`, `/javascript-typescript:javascript-testing-patterns`, `/javascript-typescript:modern-javascript-patterns`, `/javascript-typescript:nodejs-backend-patterns`, `/javascript-typescript:typescript-advanced-types`

**LLM/AI:**
`/llm-application-dev:embedding-strategies`, `/llm-application-dev:hybrid-search-implementation`, `/llm-application-dev:langchain-architecture`, `/llm-application-dev:llm-evaluation`, `/llm-application-dev:prompt-engineering-patterns`, `/llm-application-dev:rag-implementation`, `/llm-application-dev:similarity-search-patterns`, `/llm-application-dev:vector-index-tuning`

**React & Principles:**
`/react-principles`, `/vercel-react-best-practices`, `/web-design-guidelines`

**Refactoring:**
`/refractor:refractor`

**Reverse Engineering:**
`/reverse-engineering:anti-reversing-techniques`, `/reverse-engineering:binary-analysis-patterns`, `/reverse-engineering:memory-forensics`, `/reverse-engineering:protocol-reverse-engineering`

**Security:**
`/security-scanning:attack-tree-construction`, `/security-scanning:sast-configuration`, `/security-scanning:security-requirement-extraction`, `/security-scanning:security-sast`, `/security-scanning:stride-analysis-patterns`, `/security-scanning:threat-mitigation-mapping`

**Shell:**
`/shell-scripting:bash-defensive-patterns`, `/shell-scripting:bats-testing-patterns`, `/shell-scripting:shellcheck-configuration`

**Testing:**
`/test-file:test-file`

**Other:**
`/remind`, `/rules`

## Architecture Decisions (ADRs)

**Follow these accepted decisions (see `.claude/docs/decisions.md`):**

| ADR | Rule |
|-----|------|
| 0001 | Use `Result<T, E>` for errors, not exceptions |
| 0002 | Abstract AI providers, always show selection UI |
| 0003 | CORS localhost only (CVE-2024-28224) |
| 0004 | XML escape user content in prompts (CVE-2025-53773) |
| 0005 | Use `responseSchema` for AI JSON, 65536 max tokens |

## Patterns to Preserve

**Do not simplify these without reading `.claude/docs/patterns.md`:**

1. **Result<T, E>** - Type-safe error handling, 300x faster than exceptions
2. **Provider Abstraction** - Future providers planned (Ollama, Azure, etc.)
3. **CORS Localhost Restriction** - CVE-2024-28224 DNS rebinding protection
4. **XML Escaping** - CVE-2025-53773 prompt injection protection
5. **@repo/api Client** - Centralized error handling, CSRF protection
6. **No Manual Memoization** - React 19 Compiler auto-memoizes

## Security Requirements

Reference: `.claude/docs/security.md`

- CORS: Only allow localhost/127.0.0.1 origins
- Prompts: Escape `<`, `>`, `&` in user content
- Headers: X-Frame-Options: DENY, X-Content-Type-Options: nosniff

## Shared Utilities

Use these instead of inline implementations:

| Utility | Import | Purpose |
|---------|--------|---------|
| `createLazyLoader` | `@repo/core/utils/lazy-loader` | Optional module loading |
| `createErrorClassifier` | `@repo/core/utils/error-classifier` | Error pattern matching |
| `validateSchema` | `@repo/core/utils/validation` | Zod validation |
| `parseAndValidate` | `@repo/core/utils/validation` | JSON + Zod validation |
| `safeParseJson` | `@repo/core/json` | Safe JSON parsing |
| `createError` | `@repo/core/errors` | Error factory |
| `ok`/`err` | `@repo/core/result` | Result type helpers |
| `createErrorState` | `@repo/core/utils/state-helpers` | Error state factory |
| `escapeXml` | `@repo/core/sanitization` | XML escape for prompts |
| `truncate` | `@repo/core/string` | String truncation |
| `chunk` | `@repo/core/array` | Array chunking |
| `formatRelativeTime` | `@repo/core/format` | Time formatting |
| `generateFingerprint` | `@repo/core/review` | Issue deduplication fingerprint |
| `mergeIssues` | `@repo/core/review` | Deduplicate issues by fingerprint |
| `normalizeTitle` | `@repo/core/review` | Normalize issue title for comparison |
| `getHunkDigest` | `@repo/core/review` | Generate diff hunk hash |
| `shouldSuggestDrilldown` | `@repo/core/review` | Check if issue needs deeper analysis |
| `getSuggestionReason` | `@repo/core/review` | Get drilldown suggestion message |
| `TraceRecorder` | `@repo/core/review` | Record AI interaction traces |

## Review System

### Lenses

Specialized review configurations for different aspects:

| Lens | Focus |
|------|-------|
| `correctness` | Bugs, logic errors, edge cases |
| `security` | Vulnerabilities, injection, auth issues |
| `performance` | Efficiency, memory, algorithms |
| `simplicity` | Complexity, maintainability |
| `tests` | Test coverage and quality |

### Profiles

Preset lens combinations:

| Profile | Lenses | Min Severity |
|---------|--------|--------------|
| `quick` | correctness | high |
| `strict` | correctness, security, tests | all |
| `perf` | correctness, performance | medium |
| `security` | security, correctness | all |

### Agent System

Each lens maps to a named agent for UI display:

| Agent | Lens | Description |
|-------|------|-------------|
| `detective` | correctness | Finds bugs and logic errors |
| `guardian` | security | Identifies security vulnerabilities |
| `optimizer` | performance | Spots performance bottlenecks |
| `simplifier` | simplicity | Reduces complexity |
| `tester` | tests | Evaluates test coverage |

### Triage Flow

1. Parse git diff
2. Run selected lenses in parallel
3. Aggregate and deduplicate issues (fingerprinting)
4. Filter by severity
5. Save to storage with metadata

## Type Locations

- **Canonical types**: `packages/schemas/src/` (use `z.infer<typeof Schema>`)
- **Error types**: `packages/core/src/errors.ts`
- **AI types**: `packages/core/src/ai/types.ts`
- **Lens types**: `packages/schemas/src/lens.ts`
- **Triage types**: `packages/schemas/src/triage.ts`
- **Storage types**: `packages/schemas/src/triage-storage.ts`
- **Settings types**: `packages/schemas/src/settings.ts`
- **Session types**: `packages/schemas/src/session.ts`
- **Agent event types**: `packages/schemas/src/agent-event.ts`
- **Chat types**: `packages/schemas/src/chat.ts`
- **Feedback types**: `packages/schemas/src/feedback.ts`
- **Stream event types**: `packages/schemas/src/stream-events.ts`
- **Review history types**: `packages/schemas/src/review-history.ts`

## Settings System

### Settings Storage

User settings stored in `~/.config/stargazer/`:

| File | Content |
|------|---------|
| `config.json` | AI provider configuration |
| `trusted.json` | Project trust configurations |

### Settings Schema

```typescript
interface SettingsConfig {
  theme: "auto" | "dark" | "light" | "terminal";
  controlsMode: "menu" | "keys";
  defaultLenses: LensId[];
  defaultProfile: ProfileId | null;
  severityThreshold: TriageSeverity;
}

interface TrustConfig {
  projectId: string;
  repoRoot: string;
  trustedAt: string;
  capabilities: TrustCapabilities;
  trustMode: "persistent" | "session";
}
```

## Session Events

Session activity tracking with JSONL storage:

| Event Type | Purpose |
|------------|---------|
| `NAVIGATE` | Screen navigation |
| `OPEN_ISSUE` | Issue drilldown |
| `TOGGLE_VIEW` | View mode change |
| `APPLY_PATCH` | Patch application |
| `IGNORE_ISSUE` | Issue dismissal |
| `FILTER_CHANGED` | Filter modification |
| `RUN_CREATED` | New review run |
| `RUN_RESUMED` | Resume existing run |
| `SETTINGS_CHANGED` | Settings update |

## API Routes

### Server Endpoints

| Route | Purpose |
|-------|---------|
| `/health` | Health check |
| `/git` | Git operations (status, diff) |
| `/config` | AI provider configuration |
| `/settings` | User settings and trust |
| `/sessions` | Session management |
| `/sessions/:id/chat` | Chat streaming (SSE) |
| `/reviews` | Review history |
| `/triage` | Triage operations (stream, reviews) |
| `/pr-review` | PR review for CI integration |
| `/review` | Legacy review endpoint |

## Code Style

- No comments describing WHAT (code should be self-documenting)
- Only WHY comments (business reasons, workarounds, API quirks)
- Functions <20 lines, nesting <3 levels
- Use existing utilities, don't reinvent patterns

## Avoid Over-Engineering

Reference: `.claude/workflows/audits/audit-overengineering.md`

**YAGNI:** Build for current requirements, not hypothetical future needs.

| Remove | When |
|--------|------|
| Interface | Single implementation |
| Generic `<T>` | Used with only one type |
| Factory | Creates only one type |
| Wrapper | Just passes through to library |
| Config option | Never changed |
| Validation | Already validated upstream |

**Rule of Three:** Don't abstract until you have 3 real use cases.

## Project Structure

**Follow structure rules (see `.claude/docs/structure-*.md`):**

| Area | Naming | Reference |
|------|--------|-----------|
| `packages/*` | kebab-case (all files) | `structure-packages.md` |
| `apps/cli/*` | kebab-case (all files) | `structure-apps.md` |
| `apps/server/*` | kebab-case (all files) | `structure-server.md` |

**Key Rules:**
- Features cannot import from other features (compose in app layer)
- Tests co-located with source files
- Use absolute imports with `@/` prefix in apps
- Package import direction: core -> schemas (leaves: schemas, api)

**Commands:**
- `/project-structure` - Load structure context for implementation

## Workflows & Prompts

See `.claude/` folder:
- `.claude/prompts/` - Copy-paste prompts for common tasks
- `.claude/workflows/` - Detailed multi-phase workflows
- `.claude/docs/` - Reference documentation

## Testing Guidelines

Reference: `.claude/docs/testing.md`

**Philosophy:** 100% use case coverage > 100% code coverage

### What to Test

| Test | Skip |
|------|------|
| Business logic | Constants |
| Edge cases | Trivial getters/setters |
| Error handling | Framework behavior |
| User-visible behavior | CSS/styling |
| Integration points | Implementation details |

### Key Rules

1. **Test behavior, not implementation** - Assert on outcomes, not internal state
2. **Mock at boundaries** - Use MSW for network, not `vi.mock()` for modules
3. **Accessible queries** - `getByRole` > `getByTestId`
4. **userEvent > fireEvent** - Realistic user interactions
5. **One test per behavior** - Don't test same case twice
6. **Simple test data** - Avoid over-engineered factories

### Anti-Patterns to Avoid

- Spying on React hooks (useState, useEffect)
- Testing internal state variables
- Mocking modules you're testing
- Using `fireEvent` when `userEvent` works
- Using `getByTestId` as first choice
- Complex test setup with factories
- Chasing 100% code coverage
