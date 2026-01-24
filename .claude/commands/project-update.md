Update Stargazer project documentation for AI consumption.

Use Task tool with subagent_type: "documentation-specialist"

## Task

Update documentation to reflect current codebase state.

### 1. Explore Recent Changes
```bash
git log --oneline -20
```
Check packages/*/src/ and apps/*/src/ for new modules.

### 2. Update CLAUDE.md
Location: /Users/voitz/Projects/stargazer/CLAUDE.md

Keep concise. Update:
- Project Overview (if changed)
- Essential Commands (if new ones)
- Shared Utilities table (if new utilities)
- Type Locations (if new schemas)

### 3. Update Architecture Docs
Location: /Users/voitz/Projects/stargazer/docs/architecture/

Update if structure changed:
- overview.md
- monorepo-structure.md
- data-flow.md

### 4. Update Feature Docs
Location: /Users/voitz/Projects/stargazer/docs/features/

Add docs for new features. Ensure these exist and are current:
- review-flow.md
- ai-integration.md
- lenses.md

### 5. Update Reference Docs
Location: /Users/voitz/Projects/stargazer/docs/reference/

Update:
- cli-commands.md (if commands changed)
- utilities.md (if utilities added)

## Format Guidelines

Use AI-readable format:
- Clear headers
- Tables for quick reference
- Code examples
- Keep sections focused

## Output

Report:
- Files modified
- Key changes documented
- Any gaps remaining
