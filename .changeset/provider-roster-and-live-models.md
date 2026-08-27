---
"diffgazer": minor
---

Widen the provider roster and make model selection reflect what each provider actually
offers. MiniMax joins the catalog, and DeepSeek, Qwen, and Moonshot are selectable again.
Model lists are now fetched live from each provider's own API rather than a single shared
listing, so the models you can pick match the key you configured. Free-tier models are
handled end to end — selection, review execution, and results — instead of failing part
way through. Errors across the CLI now share one presentation: the same shape, wording,
and severity colors wherever they surface.
