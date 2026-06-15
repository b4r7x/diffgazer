---
"diffgazer": patch
---

Audit pass on the `diffgazer` CLI. Reworks the embedded/web/process server launchers and their factories for cleaner startup and shutdown, refines the terminal theme provider and severity colors, and tightens the web launcher and TUI entry. Behavior-preserving cleanup and bug fixes; no command-surface changes.

Reconstructed retroactively from the post-0.1.4 history; these changes predate the changeset-based flow.
