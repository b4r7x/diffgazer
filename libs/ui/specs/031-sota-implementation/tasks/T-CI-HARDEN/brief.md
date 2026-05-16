# Task T-CI-HARDEN — Pin actions by SHA + dependabot + concurrency

**Source findings:** SEC-002
**Severity:** Medium
**Phase:** 3
**Blocks:** none
**Blocked by:** T-PUBLISH-WF (don't pin before publish workflow exists)

## Goal
- `release-readiness.yml` uses mutable action tags (`actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`) — SOTA pins by SHA.
- No `.github/dependabot.yml` to update those pins.
- No `concurrency:` block on workflows.
- `id-token: write` is on non-publish workflow (move to publish in T-PUBLISH-WF, already covered).

## Files to touch (allowlist)
- `.github/workflows/release-readiness.yml` (SHA-pin actions + add concurrency)
- `.github/workflows/release.yml` (SHA-pin actions — created by T-PUBLISH-WF; if that hasn't landed yet, this brief is partial)
- `.github/dependabot.yml` (NEW — config for GitHub Actions + npm)

## Files NOT to touch
- Any other workflows
- Source code

## Acceptance criteria
- [ ] Every `uses:` line in `.github/workflows/*.yml` is `<owner>/<action>@<40-char-sha>  # <human-readable-version>`
- [ ] `.github/dependabot.yml` exists with:
  - `package-ecosystem: "github-actions"` to auto-bump SHAs weekly
  - `package-ecosystem: "npm"` for the root + key packages (monthly cadence; group minor/patch into single PR; majors separate)
- [ ] `release-readiness.yml` has `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`
- [ ] `release.yml` (if exists) has `concurrency: { group: release-${{ github.ref }}, cancel-in-progress: false }` (don't cancel publishes)
- [ ] All workflows still pass on a test PR

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
# Confirm SHA pinning
grep -E "uses: [a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+@v[0-9]" .github/workflows/*.yml
# (should return nothing — all should be @sha)
grep -E "uses: [a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+@[a-f0-9]{40}" .github/workflows/*.yml | head -10
ls -la .github/dependabot.yml
cat .github/dependabot.yml | head -30
# Validate yaml
node --eval "import('yaml').then(y => console.log(y.parse(require('fs').readFileSync('.github/dependabot.yml','utf8'))))" 2>&1 | tail -5
# Validate workflow yaml
which actionlint && actionlint .github/workflows/release-readiness.yml || echo "actionlint not installed, manual review"
```

## Notes & references
- Spec 029 §SEC-002
- Dependabot config: https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file
- To get SHA for a tag: `gh api repos/<owner>/<repo>/git/refs/tags/<tag>` or use https://github.com/<owner>/<repo>/releases

## Non-goals
- Do not add Renovate (dependabot is enough)
- Do not configure CodeQL / SAST (separate concern)
- Do not configure Slack notifications
- Do not change matrix / runner OS

## Reference SHA fetch (no-commit verification)

```bash
# Get current resolved SHA for actions/checkout@v4
gh api repos/actions/checkout/git/refs/tags/v4 --jq '.object.sha'
gh api repos/pnpm/action-setup/git/refs/tags/v4 --jq '.object.sha'
gh api repos/actions/setup-node/git/refs/tags/v4 --jq '.object.sha'
```
