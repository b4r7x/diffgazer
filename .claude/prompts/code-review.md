# Code Review Prompts

## Quick Review (5 Essential Agents)

```
Run essential code review on modified files:

1. code-reviewer - Primary bug & security detection
2. code-review-ai:architect-review - Over-abstraction detection
3. pr-review-toolkit:code-simplifier - Code simplification
4. typescript-pro - TypeScript quality
5. pr-review-toolkit:silent-failure-hunter - Error handling issues

Focus on: DRY, YAGNI, KISS, avoiding over-abstraction, SRP.
Run agents in parallel where possible.
```

---

## Full Review (4 Phases)

```
Run comprehensive code review on all git staged/modified files.

Phase 1 - Core Reviews (parallel):
- code-reviewer: bugs, security, quality issues
- typescript-pro: TypeScript patterns, type safety
- react-component-architect: React components and patterns
- backend-architect: Hono backend implementation

Phase 2 - Architecture (parallel):
- code-review-ai:architect-review: over-abstraction, unnecessary wrappers
- pr-review-toolkit:code-simplifier: simplify over-engineered code

Phase 3 - Specialized (parallel):
- pr-review-toolkit:type-design-analyzer: Zod schemas, type design
- pr-review-toolkit:silent-failure-hunter: inadequate error handling
- full-stack-orchestration:security-auditor: security vulnerabilities
- performance-optimizer: bottleneck identification

Phase 4 - Quality (parallel):
- pr-review-toolkit:pr-test-analyzer: test coverage quality
- pr-review-toolkit:comment-analyzer: documentation review
- experienced-engineer:code-quality-reviewer: clean code principles

Summarize findings by severity (critical, high, medium, low).
```

---

## Pre-Commit Review

```
Run pre-commit code review:
- code-reviewer: security and bugs
- typescript-pro: type safety
Run in parallel, report critical/high issues only.
```

---

## Security Audit

```
Run security audit:
- full-stack-orchestration:security-auditor: OWASP, auth issues
- pr-review-toolkit:silent-failure-hunter: error-related security
- code-reviewer: general security scan

Focus on: CORS, injection, credentials, headers.
Reference: .claude/docs/security.md
```

---

## Architecture Review

```
Run architecture review:
- code-review-ai:architect-review: architectural integrity, SRP
- code-archaeologist: document current architecture
- feature-dev:code-explorer: trace execution paths

Identify: unnecessary layers, wrapper functions, premature abstractions.
Preserve patterns documented in CLAUDE.md (Result type, provider abstraction, etc).
```

---

## Type Review

```
Run type design review:
- pr-review-toolkit:type-design-analyzer: schema quality, encapsulation
- typescript-pro: type system usage, generics
- code-review-ai:architect-review: type abstraction levels

Check: types in correct packages, no duplicates, proper z.infer usage.
```

---

## Test Review

```
Run test coverage review:
- pr-review-toolkit:pr-test-analyzer: coverage quality
- unit-testing:test-automator: test analysis

Flag for removal:
- Trivial tests (getters, simple property access)
- Duplicate test cases
- Implementation-detail tests
- CSS/styling tests

Keep:
- Business logic tests
- Edge case tests
- Error handling tests
```
