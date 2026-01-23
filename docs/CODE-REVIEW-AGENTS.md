# Code Review Agents Guide

## Quick Copy-Paste Prompt for Claude Code

```
Run a comprehensive code review on my React + Node.js (Hono) + Zod + TypeScript codebase.

Execute the following agents in order:

Phase 1 - Core Reviews:
- Run code-reviewer agent on all git staged/modified files
- Run typescript-pro agent to review TypeScript patterns and type safety
- Run react-component-architect agent to review React components and patterns
- Run backend-architect agent to review Hono backend implementation

Phase 2 - Architecture & Simplification:
- Run code-review-ai:architect-review to detect over-abstraction and unnecessary wrappers
- Run pr-review-toolkit:code-simplifier to simplify over-engineered code

Phase 3 - Specialized Reviews:
- Run pr-review-toolkit:type-design-analyzer to review Zod schemas and type design
- Run pr-review-toolkit:silent-failure-hunter to find inadequate error handling
- Run full-stack-orchestration:security-auditor for security vulnerabilities
- Run performance-optimizer to identify bottlenecks

Phase 4 - Quality Assurance:
- Run pr-review-toolkit:pr-test-analyzer to review test coverage
- Run pr-review-toolkit:comment-analyzer to review documentation
- Run experienced-engineer:code-quality-reviewer for clean code principles

Focus on: DRY, YAGNI, KISS, avoiding over-abstraction, SRP, removing wrappers that don't add value.
```

## Full Agent Reference

### Minimum Essential Set (Start Here)

If you're time-constrained, run these 5 agents first:

1. **code-reviewer** - Primary bug & security detection
2. **code-review-ai:architect-review** - Over-abstraction detection (critical for your goals)
3. **pr-review-toolkit:code-simplifier** - Code simplification (critical for your goals)
4. **typescript-pro** - TypeScript quality
5. **pr-review-toolkit:silent-failure-hunter** - Error handling issues

### Complete Agent List by Category

#### Core Code Review
- **code-reviewer** - Rigorous security-aware review, bugs, quality issues
- **code-review-ai:architect-review** - Architectural integrity, over-abstraction, SRP
- **pr-review-toolkit:code-simplifier** - Removes unnecessary complexity, enforces KISS/YAGNI

#### Technology Stack
- **typescript-pro** (javascript-typescript:typescript-pro) - Advanced TypeScript, generics, strict typing
- **react-component-architect** - Modern React patterns, hooks, composition
- **react-principles** - Alternative React expert for best practices
- **backend-architect** - Node.js patterns, Hono-specific, API design

#### Type & Schema Design
- **pr-review-toolkit:type-design-analyzer** - Zod schemas, type encapsulation, invariants
- Analyzes: encapsulation quality, invariant expression, enforcement

#### Error Handling & Safety
- **pr-review-toolkit:silent-failure-hunter** - Silent failures, error handling, fallback behavior
- **full-stack-orchestration:security-auditor** - OWASP, auth issues, DevSecOps

#### Performance
- **performance-optimizer** - Bottleneck identification, optimization opportunities
- **application-performance:performance-engineer** - Observability, system performance

#### Testing & Documentation
- **pr-review-toolkit:pr-test-analyzer** - Test coverage quality, missing test cases
- **pr-review-toolkit:comment-analyzer** - Comment accuracy, prevents technical debt
- **experienced-engineer:code-quality-reviewer** - DRY violations, clean code principles

#### Codebase Understanding
- **code-archaeologist** - Run FIRST on unfamiliar/legacy code, documents architecture

### Execution Strategy

#### Parallel Execution (Fastest)
Run all Phase 1 agents simultaneously, then Phase 2, etc.

#### Sequential Execution (Most Thorough)
Run one agent, fix issues, commit, run next agent.

#### Iterative Execution (Recommended)
1. Run minimum essential set (5 agents)
2. Fix critical issues
3. Run remaining specialized agents
4. Final cleanup pass

### Agent Invocation Examples

```typescript
// Run single agent
Task tool → subagent_type: "code-reviewer"

// Run multiple agents in parallel
Task tool (multiple calls in one message):
- subagent_type: "code-reviewer"
- subagent_type: "typescript-pro"
- subagent_type: "react-component-architect"
```

### What Each Agent Detects

#### DRY Violations
- code-quality-reviewer
- code-simplifier
- architect-review

#### Over-Abstraction
- architect-review (primary)
- code-simplifier (fixes)
- typescript-pro (type abstractions)

#### YAGNI Violations
- code-simplifier (primary)
- architect-review
- code-quality-reviewer

#### SRP Violations
- architect-review (primary)
- code-quality-reviewer
- backend-architect / react-component-architect

#### Unnecessary Wrappers
- architect-review (detects)
- code-simplifier (removes)
- code-quality-reviewer (flags)

#### Security Issues
- code-reviewer (general)
- security-auditor (comprehensive)
- silent-failure-hunter (error-related)

#### Performance Issues
- performance-optimizer
- typescript-pro (type performance)
- react-component-architect (React perf)

### Tech Stack Specific

#### React Reviews
- react-component-architect → Component design, hooks usage
- react-principles → Overall best practices
- performance-optimizer → Re-render optimization

#### Hono Backend Reviews
- backend-architect → API design, middleware patterns
- security-auditor → Endpoint security
- performance-optimizer → Backend performance

#### Zod Schema Reviews
- type-design-analyzer → Schema design quality
- typescript-pro → Integration with TypeScript
- architect-review → Schema abstraction levels

#### TypeScript Reviews
- typescript-pro → Type system usage
- type-design-analyzer → Type design quality
- code-quality-reviewer → Type organization

## When to Run Reviews

### Pre-Commit
- code-reviewer
- typescript-pro

### Pre-PR
- All minimum essential agents (5)

### Major Refactor
- All agents

### Weekly Quality Check
- architect-review
- code-simplifier
- code-quality-reviewer

### Security Audit
- security-auditor
- silent-failure-hunter
- code-reviewer

## Output Format

Each agent returns:
- Severity-tagged findings (critical, high, medium, low)
- Specific file locations
- Actionable recommendations
- Code examples (where applicable)

## Notes

- Agents can run in parallel for faster results
- Some agents (simplifier, architect-review) may recommend significant refactors
- Security-auditor may flag issues missed by code-reviewer
- Type-design-analyzer provides quantitative ratings (0-100)
