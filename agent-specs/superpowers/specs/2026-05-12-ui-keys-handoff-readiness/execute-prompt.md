# Execute Prompt: Diffgazer UI/Keys Handoff Readiness

## Prompt To Paste

```text
You are implementing Diffgazer UI/Keys handoff readiness:

docs/superpowers/specs/2026-05-12-ui-keys-handoff-readiness/

Goal:
Make libs/ui and libs/keys ready for public handoff through three user paths:
1. manual copy/direct shadcn registry copy,
2. dgadd,
3. npm package.

Hard repository rules:
- Read AGENTS.md before editing.
- Do NOT run git add, git stage, git commit, git stash, or destructive git commands.
- Use apply_patch for manual edits.
- Keep public registries under libs/ui/public/r and libs/keys/public/r committed.
- Do not commit deterministic generated files under ignored docs/generated or cli/add/src/generated.
- No compatibility aliases before first public release unless explicitly blessed.

Required skills/checklists before code:
1. code-audit
2. clean-code
3. code-quality
4. anti-slop
5. sota
6. react-senior-guide
7. react-useeffect
8. react-useref
9. react-anti-patterns
10. react-design-patterns
11. react-usecallback
12. react-usememo
13. react-usecontext
14. test-behavior-not-implementation for tests

Implementation order:
1. agent-briefs/01-keys-three-paths.md
2. agent-briefs/02-ui-three-paths.md
3. agent-briefs/03-registry-cli-handoff.md
4. agent-briefs/04-public-api-a11y.md
5. agent-briefs/05-web-adoption.md
6. agent-briefs/06-docs-handoff.md
7. agent-briefs/07-build-release-gates.md

After each slice:
- run the focused tests listed in that brief
- run git diff --check

After all slices:
- pnpm run prepare:artifacts
- pnpm run validate:artifacts:check
- DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
- DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
- DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
- pnpm run verify:monorepo
- git diff --check

Then run $sota-verify with this spec directory and fix every issue, including Low and Info, until CLEAN.
```

