# Roadmap

It's not a promise, anything might change, but I'm really willing to stick with it. The order reflects what I think makes sense right now, but it might shift based on feedback, time, or what I learn along the way.

## Current phase: Stabilization (now to April 2026)

Small fixes, quality improvements, refactors. No breaking changes. The codebase needs to get healthier before it gets bigger. I rushed a lot during the hackathon and I want to clean that up before adding anything new.

## Planned work (April 2026+)

Roughly in this order:

1. **Local providers** - Ollama, LM Studio, and other local inference options so your data never leaves your machine at all
2. **UI quality pass** - improve the web interface, clean up the component library, maybe extract `@diffgazer/ui` as a standalone package
3. **More cloud providers** - Anthropic (Claude) and OpenAI direct integrations
4. **File and session review** - review individual files or past sessions, not just full diffs
5. **GitHub Actions workflow** - run Diffgazer in CI to review PRs automatically
6. **Smarter analysis** - data-flow graphs, better project context, clearer context for agents to work with
7. **Headless CLI mode** - run reviews without the web UI, get results in terminal or JSON
8. **Whatever makes sense** - based on real feedback, if anyone actually uses this

No ETA on any of this. I'd rather ship something solid than hit a date, but will try to provide certain dates.

## Changes

This roadmap will be updated as things progress. If you have feature requests or ideas, [open an issue](../../issues).

---

[Back to README](../README.md)
