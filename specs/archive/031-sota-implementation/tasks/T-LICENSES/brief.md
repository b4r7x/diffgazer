# Task T-LICENSES — Fix licensing matrix + governance docs

**Source findings:** GOV-001, NEW-009, NEW-010
**Severity:** High (legal posture inconsistent; missing OSS basics)
**Phase:** 0
**Blocks:** T-PUBLISH-WF (publish without root LICENSE / valid Apache notice is OSS malpractice)
**Blocked by:** none

## Goal
Three license problems and several missing OSS governance files:

1. **No root `LICENSE`** file at repo root — GitHub will not auto-detect license; npm crawlers fail.
2. **`cli/diffgazer/LICENSE`** is Apache-2.0 boilerplate **without** the copyright appendix (the `Copyright [yyyy] [name of copyright owner]` line after "END OF TERMS AND CONDITIONS").
3. **`libs/keys/LICENSE`** copyright holder is `voitz`, while `libs/ui/LICENSE` and `cli/add/LICENSE` use `diffgazer` — pick one.
4. **`libs/registry/package.json`** declares `"license": "MIT"` but no LICENSE file ships in the directory.
5. **Missing**: root `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`.
6. **`PACKAGE_GOVERNANCE.md`** doesn't explain why `cli/diffgazer` is Apache-2.0 while scoped packages are MIT.

Decide: align all to MIT, or keep the Apache-2.0 split for `cli/diffgazer` and document it.

## Files to touch (allowlist)
- `LICENSE` (NEW — create at repo root)
- `libs/keys/LICENSE` (fix copyright holder)
- `cli/diffgazer/LICENSE` (add Apache appendix copyright)
- `libs/registry/LICENSE` (NEW — match `package.json` declaration, OR drop the field from package.json)
- `libs/registry/package.json` (if dropping the license field instead of adding LICENSE)
- `CODE_OF_CONDUCT.md` (NEW — use Contributor Covenant 2.1)
- `CONTRIBUTING.md` (NEW — link to AGENTS.md, explain PR/changeset flow)
- `.github/ISSUE_TEMPLATE/bug_report.yml` (NEW)
- `.github/ISSUE_TEMPLATE/feature_request.yml` (NEW)
- `.github/PULL_REQUEST_TEMPLATE.md` (NEW)
- `PACKAGE_GOVERNANCE.md` (add "Licensing" section documenting the matrix)

## Files NOT to touch
- Per-package READMEs (separate task)
- `SECURITY.md` / `SUPPORT.md` content (separate task)
- Any source code

## Acceptance criteria
- [ ] Root `LICENSE` exists and is MIT (recommended) OR Apache-2.0 (pick based on majority of public packages)
- [ ] `libs/keys/LICENSE` copyright matches sibling packages (`diffgazer` recommended)
- [ ] `cli/diffgazer/LICENSE` ends with proper `Copyright 2026 diffgazer\n\nLicensed under the Apache License, Version 2.0 (the "License");\n...` block per Apache standard appendix
- [ ] `libs/registry` has either a LICENSE file or no `license` field in package.json
- [ ] `CODE_OF_CONDUCT.md` exists (Contributor Covenant 2.1 boilerplate)
- [ ] `CONTRIBUTING.md` exists, references AGENTS.md, links to changeset workflow
- [ ] `.github/ISSUE_TEMPLATE/` has at least bug + feature templates
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` exists with checklist (tests, changeset, types)
- [ ] `PACKAGE_GOVERNANCE.md` has a "Licensing" section explaining the matrix
- [ ] `pnpm run verify:monorepo` still passes (check-invariants enforces LICENSE presence per public package)

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
# Per-package license consistency check
for d in libs/keys libs/ui cli/add cli/diffgazer; do
  echo "=== $d ==="
  head -3 "$d/LICENSE"
  grep -m1 '"license"' "$d/package.json"
done
ls -la LICENSE CODE_OF_CONDUCT.md CONTRIBUTING.md
ls -la .github/ISSUE_TEMPLATE/ .github/PULL_REQUEST_TEMPLATE.md
pnpm run verify:monorepo
# Confirm npm pack still includes LICENSE in tarball:
pnpm --filter @diffgazer/keys pack --dry-run | grep LICENSE
pnpm --filter @diffgazer/ui pack --dry-run | grep LICENSE
pnpm --filter @diffgazer/add pack --dry-run | grep LICENSE
pnpm --filter diffgazer pack --dry-run | grep LICENSE
```

## Notes & references
- Spec 029 §NEW-009, NEW-010; spec 028 §GOV-001.
- Contributor Covenant 2.1: https://www.contributor-covenant.org/version/2/1/code_of_conduct/
- Apache-2.0 appendix template: https://www.apache.org/licenses/LICENSE-2.0#apply
- Recommend MIT for root: it's the majority license (3 of 4 publishable packages) and most permissive.
- If keeping Apache-2.0 for `cli/diffgazer`, document why: e.g., "Apache-2.0 for the product CLI provides explicit patent grant and contributor trademark protection; libraries are MIT for ecosystem permissiveness."

## Non-goals
- Do not add a CLA bot or Developer Certificate of Origin process.
- Do not migrate any package to a different SPDX license.
- Do not modify SECURITY.md or SUPPORT.md content (separate task).
- Do not add ALL governance files at once if they're cargo-cult — pick the minimum standard set listed above.
