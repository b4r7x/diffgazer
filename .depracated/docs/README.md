# Stargazer Documentation

Local-only CLI tool for AI-powered code review. Analyzes git diffs using specialized review lenses and provides structured, actionable feedback.

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up AI provider (interactive)
stargazer run

# Review staged changes with default lens
stargazer review

# Review with specific lenses
stargazer review --lens security,performance

# Use a profile
stargazer review --profile strict
```

## Documentation Structure

| Section | Purpose |
|---------|---------|
| [Architecture](./architecture/) | System design, data flow, decisions |
| [Packages](./packages/) | Shared library documentation |
| [Apps](./apps/) | CLI and server documentation |
| [Features](./features/) | Feature implementation details |
| [UI](./ui/) | CLI component library and screens |
| [Guides](./guides/) | Tutorials and how-to guides |
| [Reference](./reference/) | CLI commands, API, utilities |

## Architecture Overview

```
stargazer/
├── packages/           # Shared libraries
│   ├── core/           # Business logic, Result type, utilities
│   │   ├── ai/         # AI client abstraction (Vercel AI SDK)
│   │   ├── review/     # Lenses, profiles, triage logic
│   │   └── storage/    # Persistence layer
│   ├── schemas/        # Zod schemas (canonical types)
│   │   ├── lens.ts     # Lens & profile schemas
│   │   ├── triage.ts   # Triage result schemas
│   │   ├── settings.ts # Settings & trust schemas
│   │   ├── session.ts  # Session event schemas
│   │   ├── agent-event.ts # Agent streaming events
│   │   ├── chat.ts     # Chat streaming schemas
│   │   └── feedback.ts # Feedback command schemas
│   └── api/            # API client for CLI-server communication
└── apps/
    ├── cli/            # React Ink terminal UI
    │   ├── features/   # Feature modules
    │   └── components/ # UI component library
    └── server/         # Hono HTTP server (localhost only)
        └── api/routes/ # REST API endpoints
```

## Key Features

### Review Lenses

Specialized configurations for different review aspects:

| Lens | Focus |
|------|-------|
| `correctness` | Bugs, logic errors, edge cases |
| `security` | Vulnerabilities, injection, auth issues |
| `performance` | Efficiency, memory, algorithms |
| `simplicity` | Complexity, maintainability |
| `tests` | Test coverage, quality |

### Review Profiles

Preset lens combinations:

| Profile | Lenses | Use Case |
|---------|--------|----------|
| `quick` | correctness | Fast review for small changes |
| `strict` | correctness, security, tests | Comprehensive PR review |
| `perf` | correctness, performance | Performance-sensitive code |
| `security` | security, correctness | Security-sensitive code |

### Agent System

Each lens maps to a named agent for UI display:

| Agent | Lens | Description |
|-------|------|-------------|
| Detective | correctness | Finds bugs and logic errors |
| Guardian | security | Identifies security vulnerabilities |
| Optimizer | performance | Spots performance bottlenecks |
| Simplifier | simplicity | Reduces complexity |
| Tester | tests | Evaluates test coverage |

### Drilldown

Deep analysis of specific issues with:
- Root cause analysis
- Impact assessment
- Step-by-step fix guidance
- Suggested patches

### Chat

Discuss review findings with AI:
- Ask clarifying questions
- Get implementation guidance
- Explore alternative solutions

### PR Review (CI Integration)

Headless review endpoint for CI pipelines:
- GitHub annotations output
- Inline comment format
- Severity-mapped annotation levels

## Key Concepts

### Result Type

All operations that can fail return `Result<T, E>` instead of throwing exceptions.

```typescript
import { ok, err, type Result } from "@repo/core";

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err("Division by zero");
  return ok(a / b);
}

const result = divide(10, 2);
if (result.ok) {
  console.log(result.value); // 5
}
```

### Security Model

Stargazer is localhost-only by design:
- Server binds to `127.0.0.1` only
- CORS restricts origins to localhost (CVE-2024-28224)
- User content is XML-escaped in prompts (CVE-2025-53773)

See [Architecture: Security](./architecture/overview.md#security) for details.

### AI Provider Abstraction

Multiple AI providers are supported through the Vercel AI SDK:
- Google Gemini (recommended, has free tier)
- OpenAI GPT-4
- Anthropic Claude

See [Features: AI Integration](./features/ai-integration.md) for details.

## Essential Commands

```bash
npm run type-check           # TypeScript validation
npm run build                # Build all packages
npx vitest run               # Run unit tests
./scripts/test-integration.sh # Run integration tests (requires chmod +x)
```

## CLI Commands

```bash
stargazer run                    # Interactive TUI
stargazer serve                  # Headless server
stargazer review                 # Review staged changes
stargazer review --unstaged      # Review unstaged changes
stargazer review --lens <ids>    # Use specific lenses
stargazer review --profile <id>  # Use a profile
stargazer review --list          # List review history
stargazer review --resume <id>   # Resume saved review
stargazer review --pick          # Interactive file picker
```

See [Reference: CLI Commands](./reference/cli-commands.md) for full documentation.

## Feature Documentation

| Feature | Documentation |
|---------|---------------|
| Review Flow | [features/review-flow.md](./features/review-flow.md) |
| Lenses | [features/lenses.md](./features/lenses.md) |
| AI Integration | [features/ai-integration.md](./features/ai-integration.md) |
| Settings | [features/settings.md](./features/settings.md) |
| Sessions | [features/sessions.md](./features/sessions.md) |

## UI Documentation

| Topic | Documentation |
|-------|---------------|
| Components | [ui/components.md](./ui/components.md) |
| Screens | [ui/screens.md](./ui/screens.md) |
| Navigation | [ui/navigation.md](./ui/navigation.md) |

## Reference Documentation

| Topic | Documentation |
|-------|---------------|
| CLI Commands | [reference/cli-commands.md](./reference/cli-commands.md) |
| API Endpoints | [reference/api-endpoints.md](./reference/api-endpoints.md) |
| Testing | [reference/testing.md](./reference/testing.md) |
| Utilities | [reference/utilities.md](./reference/utilities.md) |

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - AI assistant context
- [.claude/docs/](../.claude/docs/) - Internal reference docs
- [.claude/workflows/](../.claude/workflows/) - Development workflows
