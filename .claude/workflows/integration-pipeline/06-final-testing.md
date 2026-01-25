# Phase 6: Final Integration Testing

## Overview

Comprehensive testing and validation of all integrated features.

**Priority:** REQUIRED
**Dependencies:** All previous phases complete

---

## Agent 6.1: Create Integration Test Script

```
subagent_type: "unit-testing:test-automator"

Task: Create comprehensive integration test script.

Create: scripts/test-integration.sh

```bash
#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    🔭 Stargazer Integration Tests      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

section() {
  echo ""
  echo -e "${YELLOW}━━━ $1 ━━━${NC}"
}

# Build
section "Building packages"
if npm run build > /dev/null 2>&1; then
  pass "Build successful"
else
  fail "Build failed"
  exit 1
fi

# Type check
section "Type checking"
if npm run type-check > /dev/null 2>&1; then
  pass "Type check passed"
else
  fail "Type check failed"
fi

# Unit tests
section "Running unit tests"
if npx vitest run --reporter=dot > /dev/null 2>&1; then
  pass "Unit tests passed"
else
  fail "Some unit tests failed"
fi

# Start server
section "Starting server"
npm run -w apps/server start &
SERVER_PID=$!
sleep 3

# Wait for server
for i in {1..30}; do
  if curl -s http://localhost:7860/health > /dev/null 2>&1; then
    pass "Server started on port 7860"
    break
  fi
  if [ $i -eq 30 ]; then
    fail "Server failed to start"
    exit 1
  fi
  sleep 1
done

# Test health endpoint
section "Testing API endpoints"
if curl -s http://localhost:7860/health | grep -q "ok"; then
  pass "Health endpoint"
else
  fail "Health endpoint"
fi

# Test provider status
if curl -s http://localhost:7860/config/providers | grep -q "providers"; then
  pass "Provider status endpoint"
else
  fail "Provider status endpoint"
fi

# Create test diff
section "Testing triage system"
TEST_DIFF=$(cat << 'EOF'
diff --git a/test.ts b/test.ts
new file mode 100644
--- /dev/null
+++ b/test.ts
@@ -0,0 +1,10 @@
+function login(username: string, password: string) {
+  // SQL Injection vulnerability!
+  const query = `SELECT * FROM users WHERE username='${username}'`;
+  return db.query(query);
+}
+
+function processData(data: any) {
+  // Type safety issue
+  return data.value.nested.property;
+}
EOF
)

DIFF_JSON=$(echo "$TEST_DIFF" | jq -Rs .)

# Test streaming endpoint
echo "Testing SSE stream (5 seconds)..."
STREAM_OUTPUT=$(timeout 10 curl -s -N -X POST http://localhost:7860/triage/stream \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:7860" \
  -d "{\"diff\": $DIFF_JSON, \"lenses\": [\"security\"]}" 2>/dev/null | head -30 || true)

if echo "$STREAM_OUTPUT" | grep -q "agent_start"; then
  pass "SSE streams agent_start events"
else
  fail "SSE missing agent_start events"
fi

if echo "$STREAM_OUTPUT" | grep -q "issue_found\|agent_complete"; then
  pass "SSE streams issue/complete events"
else
  fail "SSE missing issue/complete events"
fi

# Test PR review endpoint
section "Testing PR review endpoint"
PR_OUTPUT=$(curl -s -X POST http://localhost:7860/pr-review \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:7860" \
  -d "{\"diff\": $DIFF_JSON, \"profile\": \"strict\"}")

if echo "$PR_OUTPUT" | jq -e '.summary' > /dev/null 2>&1; then
  pass "PR review returns summary"
else
  fail "PR review missing summary"
fi

if echo "$PR_OUTPUT" | jq -e '.issues' > /dev/null 2>&1; then
  pass "PR review returns issues"
else
  fail "PR review missing issues"
fi

if echo "$PR_OUTPUT" | jq -e '.annotations' > /dev/null 2>&1; then
  pass "PR review returns annotations"
else
  fail "PR review missing annotations"
fi

if echo "$PR_OUTPUT" | jq -e '.inlineComments' > /dev/null 2>&1; then
  pass "PR review returns inline comments"
else
  fail "PR review missing inline comments"
fi

ISSUE_COUNT=$(echo "$PR_OUTPUT" | jq '.issueCount')
if [ "$ISSUE_COUNT" -gt 0 ]; then
  pass "Detected $ISSUE_COUNT issues in test code"
else
  fail "No issues detected (expected at least SQL injection)"
fi

# Cleanup
section "Cleanup"
kill $SERVER_PID 2>/dev/null || true
pass "Server stopped"

# Summary
echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           Test Summary                 ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "  ${RED}Failed:${NC} $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed! ✨${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Please fix before deploying.${NC}"
  exit 1
fi
```

Steps:
1. Create scripts directory if needed
2. Create test-integration.sh
3. Make executable: chmod +x scripts/test-integration.sh
4. Run: ./scripts/test-integration.sh

Output: Integration test script
```

---

## Agent 6.2: Create Manual Testing Checklist

```
subagent_type: "documentation-specialist"

Task: Create detailed manual testing checklist.

Create: docs/testing-checklist.md

```markdown
# Stargazer Testing Checklist

Use this checklist before releases to ensure all features work correctly.

## Prerequisites

- [ ] Node.js 20+ installed
- [ ] npm packages installed (`npm ci`)
- [ ] At least one API key configured (GEMINI_API_KEY recommended)
- [ ] In a git repository

## 1. Build & Type Check

```bash
npm run build
npm run type-check
npx vitest run
```

- [ ] All packages build without errors
- [ ] Type check passes
- [ ] Unit tests pass

## 2. First Run / Onboarding

Start fresh (rename/backup existing config):
```bash
mv ~/.config/stargazer ~/.config/stargazer.bak
npm run -w apps/cli start
```

### Trust Step
- [ ] Shows current directory path
- [ ] Capability toggles work (r/g/c keys)
- [ ] "Trust & Continue" saves persistent trust
- [ ] "Trust Once" saves session trust
- [ ] "Skip" proceeds without trust

### Theme Step
- [ ] Shows 4 options (Auto, Dark, Light, Terminal)
- [ ] Preview updates on selection
- [ ] Theme persists after selection

### Provider Step
- [ ] Lists all providers (Gemini, OpenAI, Anthropic)
- [ ] Shows "Configured" badge for providers with API keys
- [ ] Selection saves correctly

### Credentials Step
- [ ] Shows input for API key
- [ ] Key is masked during input
- [ ] "Skip" option available
- [ ] Key saves to storage

### Controls Step
- [ ] Shows Menu vs Keys options
- [ ] Cheatsheet preview for selected mode

### Summary Step
- [ ] Shows all selected options
- [ ] "Finish" saves and proceeds to main menu

## 3. Main Menu (After Onboarding)

```bash
npm run -w apps/cli start
```

- [ ] Main menu appears
- [ ] "Review unstaged" option visible
- [ ] "Review staged" option visible
- [ ] "Settings" option visible
- [ ] Navigation works (arrows or j/k)
- [ ] Enter selects option

## 4. Review Flow

Make some changes to a file, then:
```bash
npm run -w apps/cli start
# Select "Review unstaged"
```

### Agent Activity (During Review)
- [ ] Agent Activity Panel appears
- [ ] Multiple agents show (Detective, Guardian, etc.)
- [ ] Agents transition: queued → running → complete
- [ ] Current action visible (e.g., "Reading file.ts")
- [ ] Progress bar updates
- [ ] Issue count increments as found

### Results (After Review)
- [ ] Split-pane view appears
- [ ] Issue list on left
- [ ] Details on right
- [ ] Summary visible

### Issue Navigation
- [ ] j/k or arrows move selection
- [ ] Selected issue highlighted
- [ ] Details update for selected issue

### Issue Details
- [ ] Title and severity visible
- [ ] Symptom/description shown
- [ ] Recommendation shown
- [ ] File and line location shown

### Tabs
- [ ] Tab key cycles through: Details → Explain → Trace → Patch
- [ ] Details tab shows issue info
- [ ] Explain tab shows evidence
- [ ] Trace tab shows tool calls (if available)
- [ ] Patch tab shows suggested fix (if available)

### Actions
- [ ] 'a' shows apply patch dialog (if patch available)
- [ ] 'i' marks issue as ignored
- [ ] Issue disappears or shows ignored state

## 5. Settings

From main menu, select "Settings":

- [ ] Shows provider status
- [ ] Shows current theme
- [ ] Shows current controls mode
- [ ] Theme change takes effect
- [ ] Controls mode change takes effect
- [ ] Changes persist after restart

## 6. Keyboard Modes

### Menu Mode
- [ ] Arrow keys navigate
- [ ] Enter selects
- [ ] Esc goes back

### Keys Mode (if enabled)
- [ ] j/k navigate
- [ ] o opens
- [ ] e explain
- [ ] t trace
- [ ] a apply
- [ ] i ignore
- [ ] ? shows help
- [ ] q quits

## 7. Server Endpoints

Start server:
```bash
npm run -w apps/server start
```

### Health
```bash
curl http://localhost:7860/health
```
- [ ] Returns {"status":"ok"}

### Provider Status
```bash
curl http://localhost:7860/config/providers
```
- [ ] Returns provider list
- [ ] Shows configured status

### Triage Stream
```bash
curl -N -X POST http://localhost:7860/triage/stream \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:7860" \
  -d '{"diff":"diff test","lenses":["security"]}'
```
- [ ] Streams SSE events
- [ ] agent_start events appear
- [ ] agent_complete events appear

### PR Review
```bash
curl -X POST http://localhost:7860/pr-review \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:7860" \
  -d '{"diff":"diff test","profile":"strict"}'
```
- [ ] Returns JSON with summary
- [ ] Returns issues array
- [ ] Returns annotations
- [ ] Returns inlineComments

## 8. GitHub Actions

On a test repository:

### Automatic Trigger
- [ ] Create PR with changes
- [ ] Workflow triggers automatically
- [ ] Annotations appear in "Files changed"
- [ ] PR comment posted

### Comment Trigger
- [ ] Comment `/ai-review` on PR
- [ ] Workflow triggers
- [ ] Rocket reaction added to comment
- [ ] Review posted

### Results
- [ ] Inline comments on issue lines
- [ ] Summary comment accurate
- [ ] Severity badges correct
- [ ] Code suggestions expandable

## 9. Error Handling

### Missing API Key
- [ ] Clear error message
- [ ] No crash

### Network Error
- [ ] Graceful handling
- [ ] Retry option or clear message

### Large Diff
- [ ] Warning shown
- [ ] Partial review or skip

### Invalid Input
- [ ] Validation errors shown
- [ ] App doesn't crash

## 10. Performance

### Small Diff (< 100 lines)
- [ ] Review completes in < 30 seconds

### Medium Diff (100-500 lines)
- [ ] Review completes in < 60 seconds

### Large Diff (500+ lines)
- [ ] Warning shown
- [ ] Review completes or graceful skip

### UI Responsiveness
- [ ] No lag during agent activity
- [ ] Smooth scrolling in issue list
- [ ] No flicker during updates

---

## Sign-off

**Tester:** ________________
**Date:** ________________
**Version:** ________________

- [ ] All critical tests pass
- [ ] No blocking issues found
- [ ] Ready for release
```

Steps:
1. Create testing-checklist.md
2. Use for manual QA

Output: Manual testing checklist
```

---

## Agent 6.3: Final Code Review

```
subagent_type: "code-reviewer"

Task: Review all new/modified code for issues.

Check these areas:

1. **Type Safety**
   - No `any` types without justification
   - Proper null checks
   - Result types used correctly

2. **Error Handling**
   - All async calls have try/catch or Result handling
   - User-friendly error messages
   - No silent failures

3. **Security**
   - No hardcoded secrets
   - XML escaping in prompts
   - CORS properly configured

4. **Performance**
   - No memory leaks in hooks
   - Proper cleanup in useEffect
   - Efficient rendering

5. **Code Quality**
   - No console.log (use proper logging)
   - No TODO without issue reference
   - Consistent naming (kebab-case files)

Files to check:
- apps/server/src/services/triage.ts
- apps/server/src/api/routes/triage.ts
- apps/server/src/api/routes/config.ts
- apps/server/src/api/routes/pr-review.ts
- packages/core/src/review/triage.ts
- apps/cli/src/features/review/api/triage-api.ts
- apps/cli/src/features/review/hooks/use-triage.ts
- apps/cli/src/features/review/hooks/use-agent-activity.ts
- apps/cli/src/app/views/review-view.tsx
- apps/cli/src/app/screens/onboarding-screen.tsx
- apps/cli/src/app/screens/settings-screen.tsx
- apps/cli/src/hooks/use-provider-status.ts

Steps:
1. Read each file
2. Check for issues
3. Report findings
4. Fix critical issues

Output: Code review report
```

---

## Agent 6.4: Run Full Validation

```
subagent_type: "unit-testing:test-automator"

Task: Run complete validation suite.

Run these commands and verify all pass:

```bash
# 1. Build
npm run build
echo "✓ Build complete"

# 2. Type check
npm run type-check
echo "✓ Type check passed"

# 3. Unit tests
npx vitest run
echo "✓ Unit tests passed"

# 4. Integration tests
./scripts/test-integration.sh
echo "✓ Integration tests passed"

# 5. Lint (if available)
npm run lint || echo "Lint not configured"

# 6. Check for console.log
echo "Checking for console.log statements..."
grep -r "console.log" packages/*/src apps/*/src --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v "node_modules" || echo "✓ No console.log found"

# 7. Check for TODO without issue
echo "Checking for TODO comments..."
grep -r "TODO" packages/*/src apps/*/src --include="*.ts" --include="*.tsx" | grep -v "#" | head -20

# 8. Check exports
echo "Checking package exports..."
npm run build 2>&1 | grep -i "error" || echo "✓ No build errors"
```

Report:
1. List any failures
2. List warnings
3. Confirm ready for release

Output: Validation report
```

---

## Validation Summary Checklist

### Build & Tests
- [ ] `npm run build` succeeds
- [ ] `npm run type-check` passes
- [ ] `npx vitest run` all tests pass
- [ ] Integration tests pass

### API Endpoints
- [ ] `/health` returns OK
- [ ] `/config/providers` returns status
- [ ] `/triage/stream` streams events
- [ ] `/pr-review` returns full response

### CLI Features
- [ ] Onboarding wizard complete
- [ ] Agent activity panel shows
- [ ] Review split-pane works
- [ ] Issue navigation works
- [ ] Settings persist

### GitHub Actions
- [ ] Automatic trigger works
- [ ] Comment trigger works
- [ ] Inline comments posted
- [ ] Annotations visible

### Code Quality
- [ ] No console.log statements
- [ ] No unhandled errors
- [ ] Type safety maintained
- [ ] Security patterns followed

---

## Ready for Release?

If all checks pass:
1. Update version in package.json files
2. Update CHANGELOG.md
3. Create release commit
4. Tag release
5. Push to main

```bash
# Example release
npm version patch -ws
git add -A
git commit -m "Release v1.x.x"
git tag v1.x.x
git push origin main --tags
```
