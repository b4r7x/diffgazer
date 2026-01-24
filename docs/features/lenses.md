# Review Lenses

Lenses customize the AI review focus. Each lens has a specific purpose, prompt, and severity rubric.

## Overview

Lenses are specialized review configurations that focus on specific aspects of code quality. They can be combined for comprehensive reviews or used individually for targeted analysis.

```
                User Request
                     |
                     v
              +-------------+
              |   Select    |
              |   Lenses    |
              +-------------+
                     |
        +------------+------------+
        |            |            |
        v            v            v
  +----------+ +----------+ +----------+
  |Correctness| | Security | |  Perf   |
  +----------+ +----------+ +----------+
        |            |            |
        v            v            v
  +----------+ +----------+ +----------+
  |  Issues  | |  Issues  | |  Issues  |
  +----------+ +----------+ +----------+
        |            |            |
        +------------+------------+
                     |
                     v
              +-------------+
              |  Aggregate  |
              | Deduplicate |
              +-------------+
```

## Built-in Lenses

| ID | Name | Focus Area |
|----|------|------------|
| `correctness` | Correctness | Bugs, logic errors, edge cases |
| `security` | Security | Vulnerabilities, injection, auth |
| `performance` | Performance | Efficiency, memory, algorithms |
| `simplicity` | Simplicity | Complexity, maintainability |
| `tests` | Tests | Test coverage, quality |

### Correctness

Focuses on bugs, logic errors, and functional correctness.

```typescript
{
  id: "correctness",
  name: "Correctness",
  description: "Analyzes code for logical errors, edge cases, and potential bugs",
  severityRubric: {
    blocker: "Logic error causing data corruption, infinite loops, or crashes",
    high: "Bug that causes incorrect results in common scenarios",
    medium: "Edge case not handled that could affect some users",
    low: "Minor logic issue with limited impact",
    nit: "Code clarity improvement that prevents future bugs",
  },
}
```

Focus areas:
- Logical errors and incorrect implementations
- Missing or incorrect edge case handling
- Off-by-one errors and boundary conditions
- Null/undefined handling issues
- Race conditions in async code
- Type mismatches and incorrect assumptions

### Security

Focuses on vulnerabilities and security best practices.

```typescript
{
  id: "security",
  name: "Security",
  description: "Identifies security vulnerabilities, injection risks, and auth issues",
  severityRubric: {
    blocker: "Remote code execution, authentication bypass, or data breach risk",
    high: "Exploitable vulnerability with significant impact (injection, XSS)",
    medium: "Security weakness requiring specific conditions to exploit",
    low: "Defense-in-depth issue or hardening recommendation",
    nit: "Security best practice suggestion with minimal risk",
  },
}
```

Focus areas:
- SQL/NoSQL injection vulnerabilities
- XSS (Cross-Site Scripting)
- Command injection risks
- Path traversal vulnerabilities
- Authentication/authorization bypasses
- Sensitive data exposure
- Insecure cryptographic practices

### Performance

Focuses on efficiency and resource usage.

```typescript
{
  id: "performance",
  name: "Performance",
  description: "Detects performance issues, memory leaks, and inefficiencies",
  severityRubric: {
    blocker: "Performance issue causing timeouts, OOM, or service unavailability",
    high: "Significant degradation affecting user experience (>1s latency)",
    medium: "Noticeable performance issue in common paths",
    low: "Optimization opportunity with moderate impact",
    nit: "Minor efficiency improvement suggestion",
  },
}
```

Focus areas:
- N+1 query patterns
- Memory leaks
- Inefficient algorithms (O(n^2) when O(n) possible)
- Unnecessary computations in hot paths
- Missing caching opportunities
- Blocking operations in async contexts

### Simplicity

Focuses on code readability and maintainability.

```typescript
{
  id: "simplicity",
  name: "Simplicity",
  description: "Reviews code for unnecessary complexity and maintainability issues",
  severityRubric: {
    blocker: "Complexity that prevents understanding or safe modification",
    high: "Significant maintainability issue requiring refactoring",
    medium: "Complexity that increases cognitive load substantially",
    low: "Readability improvement that helps future developers",
    nit: "Style preference for cleaner code",
  },
}
```

Focus areas:
- Unnecessary abstraction layers
- Over-engineered solutions
- Dead code or unused variables
- Duplicated logic
- Deep nesting
- Confusing naming

### Tests

Focuses on test quality and coverage.

```typescript
{
  id: "tests",
  name: "Tests",
  description: "Evaluates test coverage, quality, and testing best practices",
  severityRubric: {
    blocker: "Missing test for critical functionality that prevents safe deployment",
    high: "Untested code path that could cause production issues",
    medium: "Missing edge case test or test quality issue",
    low: "Test improvement that increases confidence",
    nit: "Test style or organization suggestion",
  },
}
```

Focus areas:
- Missing tests for critical paths
- Tests that don't actually test behavior
- Brittle tests coupled to implementation
- Missing error case testing
- Flaky test patterns

## Profiles

Profiles are preset lens combinations for common use cases.

| Profile | Lenses | Min Severity | Use Case |
|---------|--------|--------------|----------|
| `quick` | correctness | high | Fast review for small changes |
| `strict` | correctness, security, tests | all | Comprehensive PR review |
| `perf` | correctness, performance | medium | Performance-focused changes |
| `security` | security, correctness | all | Security-sensitive code |

### Quick Profile

Fast review focusing on critical issues only.

```typescript
{
  id: "quick",
  name: "Quick Review",
  description: "Fast review focusing on critical correctness issues",
  lenses: ["correctness"],
  filter: { minSeverity: "high" },
}
```

### Strict Profile

Comprehensive review for critical code paths.

```typescript
{
  id: "strict",
  name: "Strict Review",
  description: "Comprehensive review covering correctness, security, and tests",
  lenses: ["correctness", "security", "tests"],
}
```

### Performance Profile

Focus on efficiency and resource usage.

```typescript
{
  id: "perf",
  name: "Performance Review",
  description: "Performance-focused review with correctness baseline",
  lenses: ["correctness", "performance"],
  filter: { minSeverity: "medium" },
}
```

### Security Profile

Deep security analysis.

```typescript
{
  id: "security",
  name: "Security Audit",
  description: "Security-focused review for sensitive changes",
  lenses: ["security", "correctness"],
}
```

## Usage

### CLI Commands

```bash
# Use specific lens
stargazer review --lens security

# Use multiple lenses (comma-separated)
stargazer review --lens correctness,security,performance

# Use profile
stargazer review --profile strict

# Interactive file selection
stargazer review --pick
```

### API

```typescript
// GET /triage/stream?lenses=correctness,security
// GET /triage/stream?profile=strict
```

### Programmatic

```typescript
import { triageReview, getLenses, getProfile } from "@repo/core/review";

// Use specific lenses
const result = await triageReview(client, diff, {
  lenses: ["correctness", "security"],
});

// Use profile
const profile = getProfile("strict");
const result = await triageReview(client, diff, { profile });

// Get lens definitions
const lenses = getLenses(["correctness", "security"]);
```

## Lens Structure

```typescript
interface Lens {
  id: LensId;                    // "correctness" | "security" | ...
  name: string;                  // Display name
  description: string;           // Short description
  systemPrompt: string;          // Full AI prompt
  severityRubric: SeverityRubric; // Severity definitions
}

interface SeverityRubric {
  blocker: string;
  high: string;
  medium: string;
  low: string;
  nit: string;
}
```

## Multi-Lens Execution

When multiple lenses are used, they run sequentially:

1. Parse git diff once
2. For each lens:
   - Send prompt to AI with lens-specific instructions
   - Receive issues specific to that lens
   - Emit SSE progress events
3. Aggregate all issues
4. Deduplicate by fingerprint (file + line + title)
5. Filter by minimum severity (if profile specifies)
6. Sort by severity, then file

### Deduplication

Issues are deduplicated using a fingerprint:

```typescript
fingerprint = `${file}:${line_start}:${title.toLowerCase().slice(0, 50)}`
```

When duplicates are found, the higher severity version is kept.

## Severity Filtering

Profiles can specify a minimum severity level:

```typescript
const SEVERITY_ORDER = {
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
  nit: 4,
};

function severityMeetsMinimum(severity, minSeverity) {
  return SEVERITY_ORDER[severity] <= SEVERITY_ORDER[minSeverity];
}
```

## Type Definitions

```typescript
// packages/schemas/src/lens.ts

export const LENS_IDS = [
  "correctness",
  "security",
  "performance",
  "simplicity",
  "tests",
] as const;

export type LensId = (typeof LENS_IDS)[number];

export const PROFILE_IDS = ["quick", "strict", "perf", "security"] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];
```

## Cross-References

- [Features: Review Flow](./review-flow.md) - How lenses fit into reviews
- [Reference: CLI Commands](../reference/cli-commands.md) - Lens CLI options
- [Architecture: Data Flow](../architecture/data-flow.md) - Triage processing flow
