# /project-update - Update Project Documentation

## Purpose

Updates project documentation so AI sessions can quickly understand the codebase. Run after significant changes.

---

## Execution

Use Task tool with subagent_type: "documentation-specialist"

---

## When to Run

- After implementing new features
- After major refactoring
- After adding new packages/modules
- Before releases
- When onboarding new contributors

---

## What Gets Updated

### 1. CLAUDE.md (Primary AI Context)
The FIRST thing AI reads. Must be concise and current.

### 2. /docs/ Structure
```
/docs/
├── architecture/    # System design
├── packages/        # Package docs
├── apps/            # App docs
├── features/        # Feature docs
├── ui/              # UI documentation
├── guides/          # How-to guides
└── reference/       # CLI, API, utilities
```

### 3. Templates Used
- Package template (exports, usage, structure)
- Feature template (overview, files, data model, API)
- CLI command template (options, examples)

---

## Validation

The agent will verify:
- [ ] CLAUDE.md reflects current state
- [ ] All packages documented
- [ ] All features documented
- [ ] All CLI commands listed
- [ ] All API endpoints listed
- [ ] Code examples runnable
- [ ] No broken links

---

## AI-Readable Format

**Good:** Tables, code examples, clear headers
```markdown
| File | Purpose |
|------|---------|
| triage.ts | Initial pass |
```

**Bad:** Long prose paragraphs
```markdown
The triage file handles the initial pass while...
```

---

## Output

Agent reports:
1. Files created/modified
2. Key changes documented
3. Validation status
4. Gaps remaining
