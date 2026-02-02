# Adding Lenses

This guide explains how to create custom review lenses for specialized code analysis.

## What is a Lens?

A lens is a specialized review configuration that focuses the AI on specific aspects of code quality. Each lens defines:

- **System prompt**: Instructions for the AI
- **Severity rubric**: What constitutes each severity level
- **File triggers**: Which files to analyze

## Lens Structure

```typescript
interface Lens {
  id: string;           // Unique identifier
  name: string;         // Display name
  description: string;  // Short description
  systemPrompt: string; // AI instructions
  severityRubric: {
    critical?: string;  // What makes an issue critical
    warning?: string;
    suggestion?: string;
    nitpick?: string;
  };
  fileTriggers: string[]; // Glob patterns
}
```

## Creating a Custom Lens

### Step 1: Define the Lens

Create a YAML file in `.stargazer/lenses/`:

```yaml
# .stargazer/lenses/react-patterns.yaml

id: react-patterns
name: React Patterns
description: React-specific best practices and performance

systemPrompt: |
  You are reviewing React code. Focus on:

  1. Hook Rules
     - Hooks called unconditionally
     - Dependencies arrays correct
     - No missing dependencies
     - No stale closures

  2. Component Structure
     - Proper prop drilling vs context
     - Component size and responsibilities
     - Key prop usage in lists

  3. Performance
     - Unnecessary re-renders
     - Missing memoization where needed
     - Large bundle imports

  4. State Management
     - Derived state anti-pattern
     - State colocation
     - Lifting state appropriately

severityRubric:
  critical: |
    - Memory leaks from missing cleanup
    - Infinite re-render loops
    - Hooks called conditionally
  warning: |
    - Missing useEffect dependencies
    - Stale closure bugs
    - Prop drilling through many levels
  suggestion: |
    - Component could be split
    - Consider useMemo/useCallback
    - Better state organization
  nitpick: |
    - Naming conventions
    - File organization preferences

fileTriggers:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/components/**"
  - "**/hooks/**"
```

### Step 2: Test the Lens

```bash
# Use your custom lens
stargazer review --lens react-patterns

# Combine with built-in lenses
stargazer review --lens correctness --lens react-patterns
```

## Examples

### Security-Focused Lens

```yaml
# .stargazer/lenses/security-strict.yaml

id: security-strict
name: Security Strict
description: Deep security analysis for sensitive code

systemPrompt: |
  Perform a security-focused code review. Check for:

  1. Input Validation
     - All user input validated
     - SQL injection vectors
     - XSS vulnerabilities
     - Command injection

  2. Authentication/Authorization
     - Auth checks present
     - Session handling
     - Token validation

  3. Data Protection
     - Sensitive data exposure
     - Logging of secrets
     - Hardcoded credentials

  4. Dependencies
     - Known vulnerable patterns
     - Unsafe deserialization

severityRubric:
  critical: |
    - SQL injection
    - XSS vulnerability
    - Command injection
    - Credential exposure
    - Auth bypass
  warning: |
    - Missing input validation
    - Weak cryptography
    - Sensitive data in logs
  suggestion: |
    - Security header improvements
    - Rate limiting opportunities
  nitpick: |
    - Security best practice recommendations

fileTriggers:
  - "**/routes/**"
  - "**/api/**"
  - "**/auth/**"
  - "**/services/**"
```

### Performance Lens

```yaml
# .stargazer/lenses/perf-critical.yaml

id: perf-critical
name: Performance Critical
description: Performance analysis for hot paths

systemPrompt: |
  Analyze code for performance issues:

  1. Algorithmic Complexity
     - O(n^2) or worse in loops
     - Unnecessary iterations
     - Better data structures

  2. Memory Usage
     - Memory leaks
     - Large object creation
     - Unbounded collections

  3. I/O Efficiency
     - N+1 queries
     - Missing batching
     - Unnecessary network calls

  4. Async Patterns
     - Sequential vs parallel
     - Missing Promise.all
     - Blocking operations

severityRubric:
  critical: |
    - Memory leaks
    - Infinite loops
    - O(n^2) on large data
  warning: |
    - N+1 queries
    - Sequential when parallel possible
    - Missing caching opportunities
  suggestion: |
    - Algorithm improvements
    - Data structure optimizations

fileTriggers:
  - "**/services/**"
  - "**/lib/**"
  - "**/*.ts"
```

### Testing Lens

```yaml
# .stargazer/lenses/test-quality.yaml

id: test-quality
name: Test Quality
description: Test coverage and reliability

systemPrompt: |
  Review test code for:

  1. Coverage
     - Edge cases tested
     - Error paths covered
     - Boundary conditions

  2. Reliability
     - No flaky tests
     - Proper async handling
     - Clean test isolation

  3. Assertions
     - Meaningful assertions
     - Not testing implementation
     - Good error messages

  4. Structure
     - Clear arrange/act/assert
     - Good test names
     - Appropriate mocking

severityRubric:
  critical: |
    - Tests that always pass (no assertions)
    - Tests that never fail (false positives)
  warning: |
    - Missing error case tests
    - Flaky async tests
    - Over-mocking
  suggestion: |
    - Additional edge cases
    - Better test organization

fileTriggers:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/tests/**"
  - "**/__tests__/**"
```

## User-Level Lenses

For lenses you want across all projects, place them in:

```
~/.config/stargazer/lenses/
```

These are loaded alongside project-specific lenses.

## Lens Profiles

Create profiles to combine lenses:

```yaml
# .stargazer/profiles/strict.yaml

id: strict
name: Strict Review
description: Comprehensive review for production code

lenses:
  - correctness
  - security
  - react-patterns
  - test-quality

minSeverity: suggestion
```

Use with:

```bash
stargazer review --profile strict
```

## Best Practices

### 1. Be Specific

Good:
```yaml
systemPrompt: |
  Check for React useEffect cleanup:
  - Return cleanup functions for subscriptions
  - Cancel async operations on unmount
  - Clear timers and intervals
```

Bad:
```yaml
systemPrompt: |
  Check for bugs and issues.
```

### 2. Calibrate Severity

- **Critical**: Must fix before merge
- **Warning**: Should address in this PR
- **Suggestion**: Consider for future
- **Nitpick**: Optional style preference

### 3. Narrow File Triggers

Focus on relevant files:

```yaml
# Good - specific
fileTriggers:
  - "**/components/**/*.tsx"
  - "**/hooks/**/*.ts"

# Bad - too broad
fileTriggers:
  - "**/*"
```

### 4. Test Your Lens

1. Create a test file with known issues
2. Run your lens against it
3. Verify issues are detected at correct severity
4. Adjust prompt and rubric as needed

## Troubleshooting

### Lens Not Found

Check file location:
- Project: `.stargazer/lenses/<name>.yaml`
- User: `~/.config/stargazer/lenses/<name>.yaml`

### Too Many/Few Issues

Adjust your severity rubric to be more/less specific.

### Wrong File Types

Check your `fileTriggers` glob patterns.

## Cross-References

- [Features: Lenses](../features/lenses.md) - Lens system overview
- [Features: Review Flow](../features/review-flow.md) - How lenses are used
- [Reference: CLI Commands](../reference/cli-commands.md) - Lens CLI options
