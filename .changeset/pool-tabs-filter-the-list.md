---
"diffgazer": minor
---

The model picker's filters now sit in one header row on both surfaces: the `[Zen] [Go]`
pool tabs and the `[All] [Free] [Paid]` tier filter render side by side between the search
box and the list. The pool tabs filter the list — the active tab shows only the models its
pool serves — so the per-row pool badges are gone from both pickers; the tab itself names
the pool a save bills. When the saved model is not served by the active tab, an inline
notice names it and the tab that serves it, and the check comes back when that tab does;
a confirm only ever saves a visibly selected row. Provider names get a short form where
space is tight: "OpenCode · Zen", "OpenCode · Go", "Qwen" in headers, list rows, and
picker subtitles, while detail panes, receipts, and history keep the full product name.
