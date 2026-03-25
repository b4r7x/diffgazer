# Quickstart: Fix CLI Review Regression & Quality Audit

**Branch**: `013-fix-cli-review-audit` | **Date**: 2026-03-25

## Prerequisites

```bash
cd /Users/voitz/Projects/diffgazer-workspace/diffgazer
git checkout 013-fix-cli-review-audit
pnpm install
```

## Build & Verify

```bash
# Full build (all packages + apps)
pnpm build

# Type check
pnpm type-check
```

## Test the Review Fix

```bash
# Start CLI
pnpm dev:cli

# In the CLI:
# 1. Select "Review Staged" or "Review Unstaged"
# 2. Verify steps progress from WAIT → ACTIVE → COMPLETE
# 3. Verify summary screen appears after completion
# 4. Verify results screen shows issues
```

## Test Web Parity

```bash
# Start web (in separate terminal)
pnpm dev:web

# Navigate to: http://localhost:3001
# 1. Start a review — verify same flow as CLI
# 2. Compare settings screens side by side
# 3. Verify identical data in both apps
```

## Verify Shared Code Consolidation

```bash
# No duplicated business logic
grep -r "function filterIssues" apps/  # Should return 0 results
grep -r "function getProviderStatus" apps/  # Should return 0 results (only in packages/)
grep -r "function getProviderDisplay" apps/  # Should return 0 results (only in packages/)
grep -r "function mapStepStatus" apps/  # Should return 0 results (only in packages/)

# No dead exports
grep -r "GLOBAL_SHORTCUTS" apps/cli/  # Should return 0 results

# Consistent defaults
grep -r "parallel" apps/cli/src/app/screens/settings/agent-execution-screen.tsx  # Should not contain "parallel" as default
```

## Verify matchQueryState Adoption

```bash
# All single-query settings screens should import matchQueryState
grep -l "matchQueryState" apps/cli/src/app/screens/settings/*.tsx | wc -l  # Should be >= 5
```
