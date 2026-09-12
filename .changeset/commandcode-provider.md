---
"diffgazer": minor
---

Command Code joins the provider list. It is the Command Code Provider API — an OpenAI-compatible gateway billed through a coding plan or pay-as-you-go credits — configured with a `COMMAND_CODE_API_KEY` credential. The model picker is the provider's own live list: every model served on the OpenAI-compatible endpoint is offered; Claude models are not, because they require the Anthropic Messages endpoint. Command Code publishes no per-model prices, so rows show their context size and "pricing unknown" rather than a price badge. Zero-data-retention routing is not requested: the notice discloses the provider's default 30-day retention. A model outside your plan is refused by the provider when the review is sent, and that refusal now reads as a plan problem with the remedies named — choose another model, upgrade the plan, or add pay-as-you-go credits — instead of a generic access error.
