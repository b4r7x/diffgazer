# Roadmap

This is an approximate direction, not a promise. The order reflects current priorities but may shift based on feedback, time, or what makes sense when I get there.

## Current phase: Stabilization (now → April 2026)

Small fixes, quality improvements, refactors. No breaking changes. The codebase needs to get healthier before it gets bigger.

## Planned work (April 2026+)

Roughly in this order:

1. **Local providers** — Ollama, LM Studio, and other local inference options for full privacy (no data leaves your machine at all)
2. **UI quality pass** — improve the web interface, clean up component library, extract `@stargazer/ui` as a standalone package with its own docs
3. **More cloud providers** — Anthropic (Claude) and OpenAI direct integrations
4. **File and session review** — review individual files or past sessions, not just full diffs
5. **GitHub Actions workflow** — run Stargazer in CI to review PRs automatically
6. **Smarter analysis** — data-flow graphs, better project context understanding, clearer context documentation for agents
7. **Codebase stabilization** — full documentation, auto-docs per file, git pre-hook review, auto test writer
8. **Headless CLI mode** — run reviews without the web UI, get results in terminal or JSON
9. **Plan new features** — based on real user feedback, if there is any

## Principles

- Quality over quantity. No feature ships half-done.
- AI generation stays minimal. I want to understand every line.
- No rush. Sustainable pace beats shipping speed every time.

## Changes

This roadmap will be updated as things progress. If you have feature requests or ideas, [open an issue](../../issues).

---

[Back to README](../README.md)
