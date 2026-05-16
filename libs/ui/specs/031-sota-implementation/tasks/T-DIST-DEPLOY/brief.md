# Task T-DIST-DEPLOY — Deploy diffgazer.com OR gate all hosted-shadcn snippets

**Source findings:** DIST-001
**Severity:** Critical (every README install command is dead)
**Phase:** 1
**Blocks:** Public handoff (broken install commands sink credibility immediately)
**Blocked by:** T-DOCS-SITE (no point deploying broken docs)

## Goal
`host diffgazer.com` returns `NXDOMAIN`. Every shadcn install snippet across `README.md`, `libs/ui/README.md`, `libs/keys/README.md`, docs site MDX, and the public registry JSON files references `https://diffgazer.com/r/...` — none work.

Two paths, pick one:

**Path A (deploy):** Provision the `diffgazer.com` domain, deploy `apps/docs/.output/public/` as static files behind it, and the `apps/docs/public/r/` JSON files behind `/r/...`. Add CI smoke that `curl`s `/r/ui/registry.json` and `/r/ui/button.json` post-deploy.

**Path B (gate):** Mark every `diffgazer.com/r/...` snippet as "future" with explicit "not yet available" wording. Replace the host with a placeholder like `<your-registry-host>` or comment out the snippets entirely. Only un-gate when domain is live.

This brief assumes Path B for now (faster, no infra dependency). Path A is a follow-up infra task.

## Files to touch (allowlist for Path B)
- `README.md` (root — every `diffgazer.com/r/...` reference)
- `libs/ui/README.md`
- `libs/keys/README.md`
- `cli/add/README.md`
- `cli/diffgazer/README.md`
- `apps/docs/content/docs/**/*.mdx` (only the ones with hosted install snippets — search them)
- `libs/ui/scripts/build-shadcn-registry.ts` if it bakes the origin (probably needs to remain `https://diffgazer.com` for the JSON `$schema` and `homepage` references — verify)
- `PACKAGE_GOVERNANCE.md` (add a "Hosted registry status" section noting publish gate)

## Files NOT to touch
- `libs/ui/public/r/*.json` (JSON content — origin in there is for shadcn schema reference, not docs)
- `libs/keys/public/r/*.json` (same)
- Any source code

## Acceptance criteria

### Path B (gate)
- [ ] Every README `npx shadcn add https://diffgazer.com/r/...` snippet is either:
  - Wrapped with a clear pre-amble: "After publication (see [PACKAGE_GOVERNANCE.md#status](...)), this command will be:" followed by the command in a code block
  - OR removed entirely if the README has another working install path documented (dgadd, npm)
- [ ] Every MDX page in `apps/docs/content/docs/**` with a hosted-shadcn snippet has the same gating
- [ ] `PACKAGE_GOVERNANCE.md` has a "Hosted Registry Status" subsection that explicitly states `diffgazer.com` is not live, and what to use until then (dgadd CLI, npm packages, direct file copy from GitHub)
- [ ] No README/MDX reader will copy-paste a command that fails with DNS error
- [ ] Existing dgadd/npm install paths remain prominent and recommended

### Path A (deploy) — if doing this instead
- [ ] Domain provisioned (out of code scope; document in PACKAGE_GOVERNANCE)
- [ ] `apps/docs/.output/public/` served from `/`
- [ ] `apps/docs/public/r/` served from `/r/` (or however the registry layout maps)
- [ ] `apps/docs/public/schema/` served from `/schema/`
- [ ] CI smoke step added to release-readiness.yml: `curl -fI https://diffgazer.com/r/ui/registry.json` etc.
- [ ] HTTPS valid (Cert)
- [ ] Cache headers reasonable (short TTL for HTML, long for hashed JSON)

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
# Find all hosted snippets
rg -n "diffgazer\.com/r" README.md libs/*/README.md cli/*/README.md apps/docs/content/docs/ 2>&1 | head -30
# After Path B fix, confirm gating wording present
rg -B 2 -A 2 "diffgazer\.com/r" README.md libs/*/README.md | grep -E "future|gate|not yet|publication" | head -10
# DNS sanity (must still fail; that's expected pre-deploy)
host diffgazer.com 2>&1 | head -3
```

## Notes & references
- Spec 029 §DIST-001
- The `$schema` references inside `libs/{ui,keys}/public/r/*.json` (e.g., `"$schema": "https://diffgazer.com/schema/diffgazer.json"`) are NOT user-facing install commands — they're machine references. shadcn CLI tolerates non-resolvable schema URLs. Leave them.
- The `homepage` field in registry items can stay; it's not a hard-fail.
- Once deployed, T-PUBLISH-WF can un-gate the docs and add the CI smoke.

## Non-goals
- Do not provision the domain in this task (infra concern, out of code scope).
- Do not configure DNS records (infra).
- Do not configure CDN/Cloudflare (infra).
- Do not change the registry JSON content.
- Do not delete the hosted-install documentation — gate it for future use, don't lose it.

## Path B wording template

Before:
```markdown
## Install

```bash
npx shadcn add https://diffgazer.com/r/ui/button.json
```
```

After:
```markdown
## Install

### dgadd (recommended)

```bash
pnpm exec dgadd add ui/button
```

### npm package

```bash
npm install @diffgazer/ui
import { Button } from "@diffgazer/ui/components/button";
```

### Hosted shadcn registry (future)

The hosted registry at `https://diffgazer.com/r/` is not yet deployed. After deployment, the install command will be:

```bash
npx shadcn add https://diffgazer.com/r/ui/button.json
```

See [PACKAGE_GOVERNANCE.md](../../PACKAGE_GOVERNANCE.md#hosted-registry-status) for current status.
```
