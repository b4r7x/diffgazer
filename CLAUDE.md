@AGENTS.md

## Claude Code

- Use `AGENTS.md` as the single source of project rules.
- For React work, load `react-senior-guide` and the relevant subskills before editing.
- For audits or implementation quality checks, load `code-audit`, `anti-slop`, `clean-code`, and `code-quality`.
- For SOTA or release-readiness work, load `sota` before implementation and `sota-verify` after implementation.
- Do not rewrite entire files or modules. Provide targeted patches or unified diffs showing only the modified lines with 3 lines of context. This applies to every agent and subagent editing this repository.
