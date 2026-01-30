# Web-CLI Sync Orchestrator

Execute all web-cli-sync workflows sequentially with validation between each step.

---

## Execution Protocol

For each workflow:
1. **ANNOUNCE** - Show which workflow is about to run
2. **EXECUTE** - Run the workflow using specified agents
3. **VALIDATE** - Run quality checks
4. **STOP** - Wait for user "ok" before proceeding to next

---

## Workflow 1: Structure Audit

### Execute
```
Read: .claude/workflows/web-cli-sync/01-structure-audit.md

Agents to use (all opus):
- feature-dev:code-explorer → Analyze web pages
- feature-dev:code-explorer → Analyze CLI screens
- feature-dev:code-architect → Create mapping table
- pr-review-toolkit:type-design-analyzer → Check type consistency

Output: Structure mapping table + gap list
```

### Validate
```
Agent: code-simplifier:code-simplifier (opus)
Task: Review output for overengineering - are gaps real or imagined?

Agent: code-reviewer (opus)
Task: Verify analysis is accurate and actionable
```

### Checkpoint
**STOP HERE. Show results and wait for user "ok" before Workflow 2.**

---

## Workflow 2: Component Mirror

### Execute
```
Read: .claude/workflows/web-cli-sync/02-component-mirror.md

Agents to use (all opus):
- feature-dev:code-explorer → Inventory web components
- feature-dev:code-explorer → Inventory CLI components
- react-component-architect → Map and design missing components
- javascript-typescript:typescript-pro → Implement with proper types
- react-principles → Ensure React best practices
```

### Validate
```
Agent: feature-dev:code-reviewer (opus)
Task: Review created components for quality

Agent: code-simplifier:code-simplifier (opus)
Task: Check for overengineering - unnecessary abstractions, "just in case" code

Agent: pr-review-toolkit:type-design-analyzer (opus)
Task: Verify types are minimal and correct
```

### Checkpoint
**STOP HERE. Show results and wait for user "ok" before Workflow 3.**

---

## Workflow 3: Web Backend Connect

### Execute
```
Read: .claude/workflows/web-cli-sync/03-web-backend-connect.md

Agents to use (all opus):
- feature-dev:code-explorer → Analyze CLI API patterns
- feature-dev:code-explorer → Analyze web API state
- api-architect → Design web API layer
- backend-developer → Implement connections
- javascript-typescript:typescript-pro → TypeScript hooks
```

### Validate
```
Agent: code-simplifier:code-simplifier (opus)
Task: Check for overengineering - extra error handling, unused abstractions

Agent: pr-review-toolkit:silent-failure-hunter (opus)
Task: Verify error handling is appropriate (not excessive)

Agent: pr-review-toolkit:pr-test-analyzer (opus)
Task: Check if tests are needed
```

### Checkpoint
**STOP HERE. Show results and wait for user "ok" before Workflow 4.**

---

## Workflow 4: Backend Gaps

### Execute
```
Read: .claude/workflows/web-cli-sync/04-backend-gaps.md

Agents to use (all opus):
- feature-dev:code-explorer → Analyze server endpoints
- feature-dev:code-explorer → Analyze web requirements
- backend-development:backend-architect → Identify gaps
- api-architect → Design new endpoints
- full-stack-orchestration:security-auditor → Security review
```

### Validate
```
Agent: code-simplifier:code-simplifier (opus)
Task: Are proposed endpoints necessary or YAGNI?

Agent: documentation-specialist (opus)
Task: Is gap list clear and actionable?
```

### Final Summary
**Show complete summary of all 4 workflows.**

---

## Quick Reference

| Workflow | Key Output | Validation Focus |
|----------|------------|------------------|
| 01-structure-audit | Gap list | Are gaps real? |
| 02-component-mirror | New CLI components | Overengineering? |
| 03-web-backend-connect | API connections | Error handling right? |
| 04-backend-gaps | Endpoint specs | YAGNI check |

---

## Usage

```
Run .claude/commands/run-web-cli-sync.md
```

Or manually step through:
```
Run workflow 1, validate, wait for "ok"
Run workflow 2, validate, wait for "ok"
Run workflow 3, validate, wait for "ok"
Run workflow 4, validate, show summary
```

---

## Rules

1. **ALL agents use model=opus**
2. **Delegate to subagents** - don't bloat main context
3. **Subagents return**: file:line + one-line summary (not full contents)
4. **Stop between workflows** - user must confirm before proceeding
5. **Overengineering check after each** - remove unnecessary complexity
