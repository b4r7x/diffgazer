# Testing Guide

Stargazer uses a comprehensive testing strategy combining unit tests, integration tests, and TDD practices.

## Test Types

### Unit Tests

Fast, isolated tests for individual functions and modules using Vitest.

```bash
# Run all unit tests
npx vitest run

# Run specific test file
npx vitest run packages/core/src/review/triage.test.ts

# Watch mode for TDD
npx vitest watch

# Coverage report
npx vitest run --coverage
```

### Integration Tests

End-to-end tests validating the full system flow including server startup, API endpoints, and real AI interactions.

```bash
# Make script executable (first time only)
chmod +x scripts/test-integration.sh

# Run integration tests
./scripts/test-integration.sh

# Run with custom port
PORT=3001 ./scripts/test-integration.sh
```

## Integration Test Coverage

The integration test suite validates:

### Server Lifecycle
- Package building
- Server startup and shutdown
- Health check endpoint
- Graceful cleanup on errors

### Core Endpoints
- `/health` - Server status
- `/config/providers` - AI provider configuration
- `/git/status` - Git repository status

### Review Endpoints
- `/triage/stream` - Streaming triage with lens selection
- `/pr-review` - Complete PR review with profiles
- `/reviews` - Review history access

### Settings & Sessions
- `/settings/trust` - Project trust configuration
- `/sessions` - Session event tracking

### Security Tests
- CORS protection (blocks non-localhost origins)
- 404 handling
- Origin header validation

### Real AI Testing
Integration tests use actual diff samples to validate:
- SQL injection detection (security lens)
- Performance issue detection (performance lens)
- Multi-lens coordination (strict profile)

## Test Diff Samples

The integration script tests with realistic code samples:

### Security Issues
```typescript
function login(username: string, password: string) {
  // SQL injection vulnerability
  const query = `SELECT * FROM users WHERE username='${username}'`;
  return db.query(query);
}

// Hardcoded credentials
const API_KEY = "sk-1234567890abcdef";
```

### Performance Issues
```typescript
function findItem(items: any[], id: string) {
  // O(n²) nested loop
  for (const item of items) {
    for (const nested of item.children) {
      if (nested.id === id) return nested;
    }
  }
}
```

## Test Output

Successful run shows:
```
🔭 Stargazer Integration Test Suite
======================================

▶ Building packages
✓ Build successful
▶ Starting server on http://127.0.0.1:3000
✓ Server is ready (3s)

Running API Tests
==================

✓ Health check passed
✓ Provider status retrieved
✓ Triage stream started successfully
✓ PR review completed
✓ CORS protection working

=====================================
Test Results
=====================================
Passed: 11
Failed: 0

✅ All integration tests passed!
```

## Debugging Failed Tests

Log files are created in `/tmp`:
- `/tmp/stargazer-build.log` - Build output
- `/tmp/stargazer-server.log` - Server logs

Check these if tests fail:
```bash
tail -f /tmp/stargazer-server.log  # Live server logs
cat /tmp/stargazer-build.log        # Build errors
```

## CI/CD Integration

Integration tests can be run in CI pipelines:

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: chmod +x scripts/test-integration.sh
      - run: ./scripts/test-integration.sh
```

## Test Development Best Practices

### Unit Tests
- Co-locate tests with source files (`*.test.ts`)
- Test behavior, not implementation
- Use descriptive test names
- One assertion per test when possible

### Integration Tests
- Test complete user flows
- Use realistic test data
- Validate error handling
- Clean up resources (files, processes)

### TDD Workflow
1. Write failing test first
2. Run test to verify it fails correctly
3. Write minimal code to pass
4. Refactor with confidence
5. Commit with test and implementation together

## Performance Benchmarks

Expected test execution times:
- Unit tests: < 5 seconds
- Integration tests: 30-60 seconds (includes build + server startup)

If tests are slower, investigate:
- Unnecessary AI calls
- Missing mocks
- Synchronous file operations
- Network timeouts

## Related Documentation

- [Testing Philosophy](../../.claude/docs/testing.md)
- [TDD Best Practices](../../.claude/docs/tdd-practices.md)
- [CI/CD Configuration](../.github/workflows/)
