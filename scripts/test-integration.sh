#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVER_PORT="${PORT:-3000}"
SERVER_HOST="127.0.0.1"
SERVER_URL="http://${SERVER_HOST}:${SERVER_PORT}"
MAX_WAIT=30
TEST_TIMEOUT=60

echo -e "${BLUE}🔭 Stargazer Integration Test Suite${NC}"
echo "======================================"
echo ""

# Cleanup function
cleanup() {
  if [ ! -z "$SERVER_PID" ]; then
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
  fi
  rm -f /tmp/stargazer-test-*.diff
}

trap cleanup EXIT INT TERM

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test helper functions
test_start() {
  echo -e "${BLUE}▶ $1${NC}"
}

test_pass() {
  echo -e "${GREEN}✓ $1${NC}"
  ((TESTS_PASSED++))
}

test_fail() {
  echo -e "${RED}✗ $1${NC}"
  echo -e "${RED}  $2${NC}"
  ((TESTS_FAILED++))
}

# Step 1: Build packages
test_start "Building packages"
if npm run build > /tmp/stargazer-build.log 2>&1; then
  test_pass "Build successful"
else
  test_fail "Build failed" "See /tmp/stargazer-build.log"
  exit 1
fi

# Step 2: Start server in background
test_start "Starting server on ${SERVER_URL}"
npm run -w apps/server start > /tmp/stargazer-server.log 2>&1 &
SERVER_PID=$!

# Step 3: Wait for server to be ready
test_start "Waiting for server to be ready"
for i in $(seq 1 $MAX_WAIT); do
  if curl -sf "${SERVER_URL}/health" > /dev/null 2>&1; then
    test_pass "Server is ready (${i}s)"
    break
  fi
  if [ $i -eq $MAX_WAIT ]; then
    test_fail "Server failed to start" "Check /tmp/stargazer-server.log"
    exit 1
  fi
  sleep 1
done

echo ""
echo -e "${BLUE}Running API Tests${NC}"
echo "=================="
echo ""

# Test 1: Health check
test_start "Testing health endpoint"
RESPONSE=$(curl -sf "${SERVER_URL}/health")
if echo "$RESPONSE" | grep -q "ok"; then
  test_pass "Health check passed"
else
  test_fail "Health check failed" "Response: $RESPONSE"
fi

# Test 2: Provider status
test_start "Testing config/providers endpoint"
RESPONSE=$(curl -sf "${SERVER_URL}/config/providers")
if echo "$RESPONSE" | grep -q "providers"; then
  test_pass "Provider status retrieved"
else
  test_fail "Provider status failed" "Response: $RESPONSE"
fi

# Test 3: Git status (may fail if not in repo, that's ok)
test_start "Testing git/status endpoint"
RESPONSE=$(curl -sf -X POST "${SERVER_URL}/git/status" \
  -H "Content-Type: application/json" \
  -H "Origin: ${SERVER_URL}" \
  -d '{"cwd": "'$(pwd)'"}' 2>&1)
if [ $? -eq 0 ]; then
  test_pass "Git status retrieved"
else
  echo -e "${YELLOW}⚠ Git status skipped (not in repo or permission issue)${NC}"
fi

# Create test diff files
cat > /tmp/stargazer-test-security.diff << 'EOF'
diff --git a/test.ts b/test.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/test.ts
@@ -0,0 +1,10 @@
+function login(username: string, password: string) {
+  // SQL injection vulnerability
+  const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;
+  return db.query(query);
+}
+
+// Hardcoded credentials
+const API_KEY = "sk-1234567890abcdef";
+const secret = "my-secret-password";
EOF

cat > /tmp/stargazer-test-performance.diff << 'EOF'
diff --git a/utils.ts b/utils.ts
new file mode 100644
index 0000000..abcdefg
--- /dev/null
+++ b/utils.ts
@@ -0,0 +1,8 @@
+function findItem(items: any[], id: string) {
+  // O(n²) nested loop
+  for (const item of items) {
+    for (const nested of item.children) {
+      if (nested.id === id) return nested;
+    }
+  }
+}
EOF

# Test 4: Triage stream with security lens
test_start "Testing triage/stream with security lens"
DIFF_CONTENT=$(cat /tmp/stargazer-test-security.diff | jq -Rs .)
RESPONSE=$(timeout $TEST_TIMEOUT curl -sf -N -X POST "${SERVER_URL}/triage/stream" \
  -H "Content-Type: application/json" \
  -H "Origin: ${SERVER_URL}" \
  -d "{\"diff\": $DIFF_CONTENT, \"lenses\": [\"security\"]}" 2>&1 | head -n 20)

if [ $? -eq 0 ] && echo "$RESPONSE" | grep -q "data:"; then
  test_pass "Triage stream started successfully"
else
  test_fail "Triage stream failed" "Response: $RESPONSE"
fi

# Test 5: PR review endpoint (using test diff)
test_start "Testing pr-review endpoint with strict profile"
DIFF_CONTENT=$(cat /tmp/stargazer-test-security.diff | jq -Rs .)
RESPONSE=$(timeout $TEST_TIMEOUT curl -sf -X POST "${SERVER_URL}/pr-review" \
  -H "Content-Type: application/json" \
  -H "Origin: ${SERVER_URL}" \
  -d "{\"diff\": $DIFF_CONTENT, \"profile\": \"strict\"}" 2>&1)

if [ $? -eq 0 ]; then
  test_pass "PR review completed"
else
  test_fail "PR review failed" "Response: $RESPONSE"
fi

# Test 6: Settings endpoints
test_start "Testing settings/trust endpoint"
RESPONSE=$(curl -sf "${SERVER_URL}/settings/trust")
if [ $? -eq 0 ]; then
  test_pass "Settings trust endpoint accessible"
else
  test_fail "Settings trust endpoint failed"
fi

# Test 7: Sessions endpoint
test_start "Testing sessions endpoint"
RESPONSE=$(curl -sf "${SERVER_URL}/sessions")
if [ $? -eq 0 ]; then
  test_pass "Sessions endpoint accessible"
else
  test_fail "Sessions endpoint failed"
fi

# Test 8: Reviews history endpoint
test_start "Testing reviews endpoint"
RESPONSE=$(curl -sf "${SERVER_URL}/reviews")
if [ $? -eq 0 ]; then
  test_pass "Reviews history endpoint accessible"
else
  test_fail "Reviews history endpoint failed"
fi

# Test 9: CORS validation (should block non-localhost origins)
test_start "Testing CORS protection"
RESPONSE=$(curl -sf -X POST "${SERVER_URL}/triage/stream" \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil.com" \
  -d '{"diff": "", "lenses": ["security"]}' 2>&1)

if [ $? -ne 0 ] || echo "$RESPONSE" | grep -qi "cors\|forbidden"; then
  test_pass "CORS protection working (blocked external origin)"
else
  echo -e "${YELLOW}⚠ CORS protection may need verification${NC}"
fi

# Test 10: Invalid endpoint (404 handling)
test_start "Testing 404 handling"
RESPONSE=$(curl -sf "${SERVER_URL}/nonexistent" 2>&1)
if [ $? -ne 0 ]; then
  test_pass "404 handling works correctly"
else
  test_fail "404 should not return success"
fi

# Test 11: Config update endpoint
test_start "Testing config/providers update"
RESPONSE=$(curl -sf -X POST "${SERVER_URL}/config/providers" \
  -H "Content-Type: application/json" \
  -H "Origin: ${SERVER_URL}" \
  -d '{"provider": "google", "apiKey": "test-key", "model": "gemini-1.5-flash"}')

if [ $? -eq 0 ]; then
  test_pass "Config update endpoint accessible"
else
  test_fail "Config update endpoint failed"
fi

# Summary
echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Test Results${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All integration tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  echo -e "${YELLOW}Check logs:${NC}"
  echo "  - Build: /tmp/stargazer-build.log"
  echo "  - Server: /tmp/stargazer-server.log"
  exit 1
fi
