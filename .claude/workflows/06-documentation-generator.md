# Documentation Generator Workflow

## Overview

Generate comprehensive, AI-understandable documentation in `/docs` that explains the project structure, patterns, and decisions.

---

## Documentation Goals

1. **AI-Readable**: Future AI contexts understand the project immediately
2. **Pattern-Preserving**: Documents WHY patterns exist, not just WHAT
3. **Self-Maintaining**: Structure that encourages updates
4. **Developer-Friendly**: Useful for humans too

---

## Phase 1: Existing Docs Audit (Sequential)

### Agent 1: Current Documentation Analysis
```
Analyze existing documentation:

Locations:
- /docs/ (implementation guides)
- /docs/architecture.md (main architecture)
- /.claude/docs/ (patterns, decisions, security)
- /CLAUDE.md (project overview)

Document:
1. What's well documented
2. What's missing
3. What's outdated
4. Overlaps/conflicts
```

---

## Phase 2: Documentation Structure (Sequential)

### Agent 2: Design Doc Structure
```
Design comprehensive structure:

/docs/
├── README.md                    # Entry point, navigation
├── architecture/
│   ├── overview.md              # High-level architecture
│   ├── monorepo-structure.md    # Package organization
│   ├── data-flow.md             # How data moves through system
│   └── decisions/               # ADRs (move from .claude/docs/)
│       ├── 0001-result-types.md
│       ├── 0002-provider-abstraction.md
│       └── ...
├── packages/
│   ├── core.md                  # Core package docs
│   ├── schemas.md               # Schemas package docs
│   └── api.md                   # API client docs
├── apps/
│   ├── cli.md                   # CLI architecture & screens
│   └── server.md                # Server architecture & routes
├── features/
│   ├── review-flow.md           # How review works
│   ├── ai-integration.md        # AI SDK usage
│   ├── persistence.md           # Storage & state
│   └── lenses.md                # Lenses system
├── guides/
│   ├── getting-started.md       # Quick start
│   ├── adding-features.md       # How to add features
│   ├── adding-lenses.md         # How to create lenses
│   └── testing.md               # Testing patterns
└── reference/
    ├── cli-commands.md          # All CLI commands
    ├── api-endpoints.md         # All API routes
    ├── schemas.md               # All Zod schemas
    └── utilities.md             # Shared utilities
```

---

## Phase 3: Core Documentation (Parallel)

### Agent 3: Architecture Documentation
```
Create/update architecture docs:

1. /docs/architecture/overview.md
   - System components diagram (text-based)
   - Key architectural decisions summary
   - Technology stack rationale

2. /docs/architecture/monorepo-structure.md
   - Package purposes
   - Import boundaries
   - Build order

3. /docs/architecture/data-flow.md
   - Request flow (CLI → Server → AI → Response)
   - Event flow (SSE)
   - State management
```

### Agent 4: Package Documentation
```
Document each package:

1. /docs/packages/core.md
   - Purpose
   - Key modules (result, errors, ai, storage, etc.)
   - Public API
   - Usage examples

2. /docs/packages/schemas.md
   - All schemas with descriptions
   - Type inference patterns
   - Validation examples

3. /docs/packages/api.md
   - Client usage
   - Error handling
   - CSRF protection
```

### Agent 5: App Documentation
```
Document each app:

1. /docs/apps/cli.md
   - Bulletproof React structure
   - Screens and navigation
   - Feature modules
   - State management

2. /docs/apps/server.md
   - Bulletproof Node.js structure
   - Route handlers
   - Services
   - Middleware
```

---

## Phase 4: Feature Documentation (Parallel)

### Agent 6: Review Flow Documentation
```
Create /docs/features/review-flow.md:

1. Overview of review process
2. 3-stage flow (collect → triage → drilldown)
3. Issue lifecycle (open → applied/ignored/fixed)
4. CLI interaction patterns
5. Code examples
```

### Agent 7: AI Integration Documentation
```
Create /docs/features/ai-integration.md:

1. AI SDK usage
2. Provider configuration
3. Structured output patterns
4. Tool definitions
5. Error handling
6. Token management
```

### Agent 8: Lenses Documentation
```
Create /docs/features/lenses.md:

1. What lenses are
2. Built-in lenses
3. How to create custom lenses
4. Lens configuration
5. Profile presets
```

---

## Phase 5: Reference Documentation (Parallel)

### Agent 9: CLI Reference
```
Create /docs/reference/cli-commands.md:

1. All commands with:
   - Syntax
   - Options
   - Examples
   - Related commands
```

### Agent 10: API Reference
```
Create /docs/reference/api-endpoints.md:

1. All endpoints with:
   - Method, path
   - Request/response schemas
   - Authentication
   - Examples
```

### Agent 11: Utilities Reference
```
Create /docs/reference/utilities.md:

1. All shared utilities with:
   - Import path
   - Purpose
   - Usage example
   - When to use
```

---

## Phase 6: Guides (Sequential)

### Agent 12: Developer Guides
```
Create guides:

1. /docs/guides/getting-started.md
   - Prerequisites
   - Installation
   - First review
   - Configuration

2. /docs/guides/adding-features.md
   - Feature module structure
   - Where to put code
   - Testing requirements

3. /docs/guides/adding-lenses.md
   - Lens file structure
   - System prompt writing
   - Severity rubric
   - Testing lenses

4. /docs/guides/testing.md
   - Test organization
   - What to test
   - Mocking patterns
```

---

## Phase 7: AI Context Optimization (Sequential)

### Agent 13: CLAUDE.md Update
```
Update /CLAUDE.md:

1. Keep it concise (AI context limit)
2. Reference /docs/ for details
3. Include:
   - Quick commands
   - Key patterns (don't simplify)
   - Security requirements
   - Utility locations
```

### Agent 14: Navigation & Cross-References
```
Add navigation:

1. /docs/README.md with full navigation
2. Cross-references between docs
3. "See also" sections
4. Consistent header structure for AI parsing
```

---

## Expected Output

1. **Structured /docs/**: Complete documentation tree
2. **Updated CLAUDE.md**: Optimized for AI context
3. **Cross-References**: Linked documentation
4. **AI-Optimized**: Clear, parseable format

---

## Documentation Format Guidelines

### For AI Readability
```markdown
# Component Name

## Purpose
One sentence explaining what this does.

## Location
`path/to/file.ts`

## Key Concepts
- Concept 1: explanation
- Concept 2: explanation

## Usage
\`\`\`typescript
// Example code
\`\`\`

## Related
- [Link to related doc](./related.md)
```

### For Pattern Preservation
```markdown
## Pattern: Name

### What
Brief description.

### Why
Business/technical reason this exists.

### When to Use
Conditions for using this pattern.

### When NOT to Use
Anti-patterns, exceptions.

### Example
Code example.
```
