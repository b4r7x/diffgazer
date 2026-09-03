---
"diffgazer": minor
---

On OpenRouter and OpenCode Zen, a dispatch that sends no response headers, or only
keep-alive filler, for the idle budget is given up on and re-dispatched once inside the
same wall. Four flash models that think by default — `qwen3.8-flash`, `glm-5.3-flash` and
`deepseek-v4-flash` on OpenCode Zen, `glm-5.3-flash` on Z.AI — now get a reasoning cap on
the wire, so those reviews finish in seconds rather than minutes; OpenRouter's reasoning
routes carry a token bound of their own. A new `reviewWallTimeCapMs` setting caps a
review's total wall clock. A batch that fails on a timeout, a 5xx or a rate limit is
retried once while the review clock still fits a dispatch, and a re-queued batch no longer
shows up as a failed lens. A cancelled review is readable as a saved run the moment the
cancel returns, lens errors carry their diagnostic code, and Ollama Cloud's billing text
matches its published rates.
