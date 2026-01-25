# Scripts Directory

Utility scripts for development, testing, and deployment.

## Integration Tests

### `test-integration.sh`

Comprehensive integration test suite that validates the full Stargazer flow.

**Setup (first time only):**
```bash
chmod +x scripts/test-integration.sh
```

**Usage:**
```bash
# Run with default port (3000)
./scripts/test-integration.sh

# Run with custom port
PORT=3001 ./scripts/test-integration.sh
```

**What it tests:**
1. Package build process
2. Server startup and health check
3. API endpoints (health, config, git, triage, reviews, settings, sessions)
4. Streaming triage with security lens
5. PR review with strict profile
6. CORS protection
7. Error handling (404, invalid requests)
8. Config updates

**Test data:**
- Creates temporary diff files in `/tmp/stargazer-test-*.diff`
- Tests real security issues (SQL injection, hardcoded credentials)
- Tests performance issues (O(n²) algorithms)

**Output:**
- Colored test results (✓ pass, ✗ fail, ⚠ skip)
- Test count summary
- Log file locations for debugging

**Exit codes:**
- `0` - All tests passed
- `1` - One or more tests failed or build error

**Logs:**
- Build output: `/tmp/stargazer-build.log`
- Server output: `/tmp/stargazer-server.log`

**Requirements:**
- Node.js 18+
- pnpm installed
- `curl` and `jq` available
- Valid AI provider configuration (for triage tests)

**Cleanup:**
- Automatically kills server process on exit
- Removes temporary test diff files
- Uses trap for cleanup on SIGINT/SIGTERM

## CI/CD Usage

Can be integrated into GitHub Actions or other CI systems:

```yaml
- name: Run integration tests
  run: |
    chmod +x scripts/test-integration.sh
    ./scripts/test-integration.sh
```

## Development Tips

### Debugging Failed Tests

1. Check server logs:
   ```bash
   tail -f /tmp/stargazer-server.log
   ```

2. Check build logs:
   ```bash
   cat /tmp/stargazer-build.log
   ```

3. Run server manually:
   ```bash
   npm run -w apps/server dev
   ```

4. Test individual endpoints:
   ```bash
   curl -s http://127.0.0.1:3000/health | jq .
   ```

### Extending Tests

To add new tests, follow this pattern:

```bash
test_start "Description of test"
RESPONSE=$(curl -sf "${SERVER_URL}/endpoint" ...)

if [ $? -eq 0 ] && echo "$RESPONSE" | grep -q "expected"; then
  test_pass "Test passed"
else
  test_fail "Test failed" "Response: $RESPONSE"
fi
```

### Test Helpers

- `test_start "message"` - Print test starting message
- `test_pass "message"` - Print success and increment pass counter
- `test_fail "message" "details"` - Print failure with details and increment fail counter

## Related Documentation

- [Testing Guide](../docs/reference/testing.md)
- [API Documentation](../docs/reference/api-endpoints.md)
- [TDD Practices](../.claude/docs/testing.md)
