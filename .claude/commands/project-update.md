Update Stargazer project documentation for AI consumption.

Use Task tool with subagent_type: "documentation-specialist"

---

## Task

Update documentation to reflect current codebase state. Ensure AI agents can quickly understand the project.

---

## Phase 1: Explore Recent Changes

```bash
git log --oneline -20
```

Check for new modules:
- `packages/*/src/` - New utilities, schemas
- `apps/cli/src/features/` - New features
- `apps/server/src/api/routes/` - New endpoints

---

## Phase 2: Update CLAUDE.md (Primary AI Context)

Location: `/Users/voitz/Projects/stargazer/CLAUDE.md`

This is the FIRST thing AI reads. Keep it **concise** and **current**.

Update sections:
- Project Overview (if changed)
- Essential Commands (if new ones)
- Architecture Decisions (if new ADRs)
- Shared Utilities table (if new utilities)
- Type Locations (if new schemas)
- Review System tables (if lenses/profiles changed)

---

## Phase 3: Update /docs/ Structure

Ensure this structure exists and is current:

```
/docs/
├── README.md                    # Index with quick links
├── architecture/
│   ├── overview.md              # System architecture
│   ├── monorepo-structure.md    # Package organization
│   └── data-flow.md             # Request/data flow
├── packages/
│   ├── core.md                  # @repo/core
│   ├── schemas.md               # @repo/schemas
│   └── api.md                   # @repo/api
├── apps/
│   ├── cli.md                   # CLI app
│   └── server.md                # Server app
├── features/
│   ├── review-flow.md           # Code review
│   ├── ai-integration.md        # AI providers
│   ├── lenses.md                # Lens system
│   ├── settings.md              # Settings & config
│   └── sessions.md              # Session management
├── ui/
│   ├── components.md            # UI component library
│   ├── screens.md               # Screen descriptions
│   └── navigation.md            # Navigation flow
├── guides/
│   ├── getting-started.md       # Quick start
│   ├── development.md           # Dev setup
│   ├── adding-features.md       # Feature guide
│   └── adding-lenses.md         # Lens guide
└── reference/
    ├── cli-commands.md          # CLI reference
    ├── api-endpoints.md         # API reference
    └── utilities.md             # Utility reference
```

---

## Phase 4: Document Templates

### Package Template
```markdown
# Package: @repo/[name]

## Purpose
[One paragraph]

## Key Exports
| Export | Description |
|--------|-------------|
| `foo()` | Does X |

## Usage
\`\`\`typescript
import { foo } from "@repo/[name]";
\`\`\`

## File Structure
\`\`\`
src/
├── index.ts
└── feature/
\`\`\`
```

### Feature Template
```markdown
# Feature: [Name]

## Overview
[What and why]

## Key Files
| File | Purpose |
|------|---------|
| `path/to/file.ts` | Does X |

## Data Model
\`\`\`typescript
interface Foo { bar: string }
\`\`\`

## API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/foo` | GET | Gets foo |
```

### CLI Command Template
```markdown
### `stargazer [command]`
[Description]

Options:
| Flag | Description | Default |
|------|-------------|---------|
| `--flag` | Does X | value |

Examples:
\`\`\`bash
stargazer command --flag value
\`\`\`
```

---

## Phase 5: Validation Checklist

- [ ] CLAUDE.md reflects current state
- [ ] All packages documented in /docs/packages/
- [ ] All features documented in /docs/features/
- [ ] All CLI commands in /docs/reference/cli-commands.md
- [ ] All API endpoints in /docs/reference/api-endpoints.md
- [ ] Code examples are runnable
- [ ] No broken links
- [ ] No TODO placeholders

---

## AI-Readable Format Guidelines

### Good (AI parses quickly):
```markdown
## Feature: Review Engine

**Location:** `packages/core/src/review/`

| File | Purpose |
|------|---------|
| triage.ts | Initial review pass |
| drilldown.ts | Deep analysis |

\`\`\`typescript
import { triageReview } from '@repo/core/review';
\`\`\`
```

### Bad (AI struggles):
```markdown
The review engine is located in the core package and contains
various files for different purposes. The triage file handles
the initial pass while drilldown does deeper analysis...
```

**Rules:**
- Tables over prose
- Code examples over descriptions
- Headers for structure
- Links for cross-references

---

## Output

Report:
1. Files created/modified
2. Key changes documented
3. Validation checklist status
4. Any gaps remaining
