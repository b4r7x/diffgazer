# How It Works

What happens when you click "Review".

## Review pipeline

Every review goes through five steps, streamed to the UI via SSE.

**1. Diff** - parse the git diff (staged or unstaged), validate it's under 512KB, filter out non-reviewable files (binaries, lockfiles, etc.).

**2. Context** - figure out which lenses to run, build a project context snapshot (language, framework, structure), cache it for next reviews.

**3. Review** - run the selected lenses. Each lens gets its own prompt with the diff, project context, severity rubric, and security hardening instructions. User content in prompts is XML-escaped to prevent prompt injection. Lenses run in parallel or sequential mode depending on your settings.

**4. Enrich** - for every issue found, pull git blame (who last touched the affected line) and grab surrounding code (5 lines before and after).

**5. Report** - deduplicate overlapping issues across lenses, filter by your severity threshold, sort by severity, save.

## Lenses

Lenses are AI agents, each with its own prompt and severity rubric.

| Lens | Agent | Badge | What it looks for |
|------|-------|-------|-------------------|
| Correctness | Detective | DET | Logic errors, edge cases, null handling, race conditions |
| Security | Guardian | SEC | OWASP Top 10, injection, XSS, auth bypass, data exposure |
| Performance | Optimizer | PERF | N+1 queries, memory leaks, algorithmic complexity |
| Simplicity | Simplifier | SIM | Over-engineering, dead code, SRP violations, naming |
| Tests | Tester | TEST | Missing tests, brittle tests, flaky patterns |

You can enable any combination, or use a profile.

## Profiles

Preset lens + severity combinations.

| Profile | Lenses | Severity Filter | Use case |
|---------|--------|-----------------|----------|
| Quick | Correctness | High and above | Fast scan for critical issues |
| Strict | Correctness, Security, Tests | None (show all) | Pre-merge review |
| Perf | Correctness, Performance | Medium and above | Performance-focused |
| Security | Security, Correctness | None (show all) | Security audit |

## Issue severity

| Severity | Meaning | Examples |
|----------|---------|----------|
| Blocker | Will cause failures in production | Data corruption, crashes, infinite loops |
| High | Significant problems | Bugs with clear impact, security vulnerabilities |
| Medium | Worth investigating | Edge cases, error handling gaps |
| Low | Not urgent | Best practice violations, minor refactors |
| Nit | Take it or leave it | Style, naming, trivial suggestions |

## Streaming

The UI shows four things during a review:

- **Step progression** - which pipeline step is running
- **Agent board** - status per lens (queued, running, complete, error)
- **Activity log** - terminal-style feed of what's happening
- **Metrics** - files processed, issues found, elapsed time

If the browser disconnects mid-review, the session keeps running server-side. Reconnecting replays buffered events.

## Drilldowns

You can click any issue to get more detail from the AI:

- Root cause analysis
- Impact assessment
- Suggested fix
- Patch
- Related issues in the same review
- External references

Drilldowns are saved with the review so they don't run again on the same issue.

## Enrichment

Every issue gets two extra pieces of context added after the review:

- **Git blame** - who last modified the affected line and when
- **Code context** - the surrounding lines of the affected code

## Session management

Reviews are tracked as sessions:

- **Resumability** - if the browser disconnects, the review continues server-side. Reconnecting replays buffered events.
- **Session reuse** - same commit + git status + mode as an existing session = replay, not a new run.
- **Staleness detection** - if the repo state changed since the review, you get a 409.
- **Limits** - max 50 concurrent sessions, 30-minute timeout.

## Agent execution

Two modes:

- **Parallel** - all lenses run at the same time. Faster, but sends multiple concurrent requests to your provider. Works with Gemini, might not with others.
- **Sequential** - one at a time. Slower but works with any provider. Default.

Configure in Settings > Analysis.

---

[Back to README](../README.md)
