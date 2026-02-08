# AI Providers

Stargazer supports multiple AI providers for code review. You pick one during onboarding and can switch anytime from Settings > Providers. Multiple providers can be configured simultaneously -- one is active at a time.

## Provider Comparison

| Provider | Default Model | Free Tier | Env Var | Parallel Agents | Speed | Review Quality |
|----------|--------------|-----------|---------|-----------------|-------|----------------|
| Google Gemini | gemini-2.5-flash | Yes (5 models) | `GOOGLE_API_KEY` | Yes | Fast | Good |
| Z.AI | glm-4.7 | Yes (1 model) | `ZAI_API_KEY` | Limited | Moderate | Good |
| Z.AI Coding | glm-4.7 | Yes (1 model) | `ZAI_API_KEY` | Limited | Moderate | Good |
| OpenRouter | dynamic list | Varies by model | `OPENROUTER_API_KEY` | Varies | Varies | Varies |

OpenRouter gives you access to Claude, GPT, Llama, and dozens of other models through a single API key. The model list is fetched dynamically and cached for 24 hours.

## Why Gemini Is the Default

Honest take: I don't love Gemini for writing code, but for review it hits a sweet spot.

During testing across providers, Gemini Flash consistently came out ahead on the metrics that matter for this use case:

- **Fast.** Reviews complete quickly, even with all 5 lenses running in parallel.
- **Cheap.** The free tier quota allows 2-3 full reviews on large PRs per rate limit cycle. For a tool you run before pushing, that's enough.
- **Accurate for review.** Code review is a different task than code generation. You need a model that reads carefully and finds real issues without hallucinating false positives. Gemini Flash does this well.
- **Parallel execution works reliably.** Other providers had issues handling 5 concurrent requests. Gemini handles it without dropping connections or returning errors.
- **Best quality-to-cost ratio** found during development and real-world usage.

If you have a preferred provider or want to use a specific model (say, Claude via OpenRouter), go for it. But if you just want something that works out of the box, Gemini is the recommendation.

## Configuration

Two ways to provide API keys:

**During onboarding** -- the setup wizard walks you through selecting a provider and entering your key. Keys are stored in either:
- OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Encrypted file (`~/.stargazer/secrets.json` with `0600` permissions)

**Via environment variables** -- set `GOOGLE_API_KEY`, `ZAI_API_KEY`, or `OPENROUTER_API_KEY` in your shell. Environment variables override stored keys, so you can use them for temporary overrides or CI environments.

## Agent Execution Modes

Stargazer runs up to 5 specialized review agents (lenses). How they execute depends on your chosen mode:

**Parallel** -- all lenses run simultaneously. Faster, but requires a provider that handles concurrent requests well. Gemini works great for this. This is the mode you want if your provider supports it.

**Sequential** -- one lens at a time. Slower but works reliably with any provider. This mode exists because some providers couldn't handle 5 parallel requests without dropping connections or hitting rate limits.

You can change this anytime in Settings > Analysis.

## Switching Providers

Open Settings > Providers. You can:
- Add credentials for a new provider
- Switch the active provider
- Delete a provider's credentials
- Test that a provider is working

Your review history is independent of the provider -- switching doesn't affect past reviews.

## Future Providers

Planned integrations:
- **Anthropic (Claude)** and **OpenAI** direct -- no OpenRouter middleman
- **Local providers** (Ollama, LM Studio) -- for full privacy, no data leaves your machine at all

---

[Back to README](../README.md)
