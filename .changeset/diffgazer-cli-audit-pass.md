---
"diffgazer": minor
---

Audit pass on the `diffgazer` CLI. Reworks the embedded/web/process server launchers and their factories for cleaner startup and shutdown, refines the terminal theme provider and severity colors, and tightens the web launcher and TUI entry. The TUI `--theme` option now accepts only `auto`, `dark`, `light`, or `high-contrast`; unsupported values fail validation instead of falling back to `dark`.

Reconstructed retroactively from the post-0.1.4 history; these changes predate the changeset-based flow.
