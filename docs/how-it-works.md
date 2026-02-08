# How It Works

What happens when you click "Review" in Stargazer.

## Review Pipeline

Every review runs through five steps, streamed to the UI in real time.

**1. Diff** -- Parse the git diff (staged or unstaged), validate it's under 512KB, and filter out non-reviewable files (binaries, lockfiles, etc.).

**2. Context** -- Resolve which lenses to run, build a project context snapshot (language, framework, structure), and cache it for subsequent reviews.

**3. Review** -- Orchestrate the selected lenses. Each lens gets its own AI prompt with the diff, project context, severity rubric, and security hardening instructions. All user content in prompts is XML-escaped to prevent prompt injection. Lenses run in parallel or sequential mode depending on your settings.

**4. Enrich** -- For every issue found, pull git blame (who last touched the affected line) and grab surrounding code context (5 lines before and after) for better understanding.

**5. Report** -- Deduplicate overlapping issues across lenses, filter by your severity threshold, sort by severity, persist the review, and emit the completion event.

## Lenses

Lenses are specialized AI agents, each with expert-tuned prompts and severity rubrics.

| Lens | Agent | Badge | What It Looks For |
|------|-------|-------|-------------------|
| Correctness | Detective | DET | Logic errors, edge cases, null handling, race conditions |
| Security | Guardian | SEC | OWASP Top 10, injection, XSS, auth bypass, data exposure |
| Performance | Optimizer | PERF | N+1 queries, memory leaks, algorithmic complexity |
| Simplicity | Simplifier | SIM | Over-engineering, dead code, SRP violations, naming |
| Tests | Tester | TEST | Missing tests, brittle tests, flaky patterns |

You can enable any combination of lenses, or use a profile to get a curated set.

## Profiles

Profiles are preset lens + severity combinations for common review scenarios.

| Profile | Lenses | Severity Filter | Use Case |
|---------|--------|-----------------|----------|
| Quick | Correctness | High and above | Fast scan for critical issues |
| Strict | Correctness, Security, Tests | None (show all) | Comprehensive pre-merge review |
| Perf | Correctness, Performance | Medium and above | Performance-focused review |
| Security | Security, Correctness | None (show all) | Security audit |

## Issue Severity

| Severity | Meaning | Examples |
|----------|---------|----------|
| Blocker | Will cause failures in production | Data corruption, crashes, infinite loops |
| High | Significant problems that need fixing | Bugs with clear impact, security vulnerabilities |
| Medium | Potential issues worth investigating | Edge cases, error handling gaps |
| Low | Improvements, not urgent | Best practice violations, minor refactors |
| Nit | Take it or leave it | Style, naming, trivial suggestions |

## Streaming

Reviews stream progress via Server-Sent Events (SSE) with 18 event types. The UI shows four things during a review:

- **Step progression** -- which of the 5 pipeline steps is currently running.
- **Agent board** -- real-time status per lens agent (queued, running, complete, error).
- **Activity log** -- terminal-style feed of what's happening (files being processed, issues found, agents starting/finishing).
- **Metrics** -- files processed, issues found, elapsed time.

If your browser disconnects mid-review, the session keeps running server-side. Reconnect and you'll get all buffered events replayed.

## Drilldowns

Click any issue to request a drilldown -- a deep-dive AI analysis that returns:

- Root cause analysis
- Impact assessment
- Suggested fix with rationale
- Concrete patch
- Related issues in the same review
- External references

Drilldowns are persisted with the review, so you don't pay for the same analysis twice.

## Enrichment

Every issue gets automatically enriched with two pieces of context:

- **Git blame** -- who last modified the affected line and when. Useful for knowing who to talk to about the change.
- **Code context** -- the surrounding lines of the affected code, so you can understand the issue without switching to your editor.

## Session Management

Reviews are tracked as sessions. Key behaviors:

- **Resumability** -- if the browser disconnects, the review continues server-side. Reconnecting replays buffered events.
- **Session reuse** -- if you start a review with the same commit, git status, and mode as an existing session, Stargazer replays it instead of running a new one.
- **Staleness detection** -- if you resume a review but the repo state has changed (new commits, different working tree), Stargazer returns a 409 so you know the results are outdated.
- **Limits** -- max 50 concurrent sessions, 30-minute timeout per session.

## Agent Execution

Two modes for running lenses:

- **Parallel** -- all lenses fire simultaneously. Faster total wall time, but sends multiple concurrent requests to your AI provider. Works well with providers that handle concurrent requests (Gemini, OpenRouter with high rate limits).
- **Sequential** -- one lens at a time. Slower but predictable. Works with any provider regardless of rate limits. This is the default.

Configure this in Settings > Analysis, or during onboarding.

---

[Back to README](../README.md)
