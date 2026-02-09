# AI Providers

Stargazer supports multiple AI providers for code review (will be supporting more). You pick one during onboarding and can switch anytime from Settings -> Providers. You can have multiple providers configured, one is active at a time.

## Provider comparison

| Provider | Default Model | Free Tier | Env Var | Parallel Agents | Speed | Review Quality |
|----------|--------------|-----------|---------|-----------------|-------|----------------|
| Google Gemini | gemini-2.5-flash | Yes (5 models) | `GOOGLE_API_KEY` | Yes | Fast | Good |
| Z.AI | glm-4.7 | Yes (1 model) | `ZAI_API_KEY` | Limited | Moderate | Good |
| Z.AI Coding | glm-4.7 | Yes (1 model) | `ZAI_API_KEY` | Limited | Moderate | Good |
| OpenRouter | dynamic list | Varies by model | `OPENROUTER_API_KEY` | Varies | Varies | Varies |

OpenRouter gives you access to Claude, GPT, Llama, and dozens of other models through a single API key. The model list is fetched dynamically and cached for 24 hours.

## Why Gemini is the default

I don't like Gemini for writing code, but for review it does fine.

During testing, Gemini Flash came out ahead for this use case:

- **Fast.** Reviews complete quickly, even with all 5 lenses in parallel.
- **Cheap.** Free tier allows 2-3 full reviews on large PRs per rate limit cycle. For running before a push, that's enough for me.
- **Parallel execution works.** Other providers had issues with 5 concurrent requests (I got errors with GLM Coding Plan for example). Gemini didn't drop connections.
- **Decent quality-to-cost ratio** from what I've seen.

If you have a preferred provider or want to use something specific (say, Claude via OpenRouter), go for it.

## Configuration

Two ways to provide API keys:

**During onboarding** - the setup wizard walks you through selecting a provider and entering your key. Keys are stored in either:
- OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- File storage (`~/.stargazer/secrets.json` with `0600` permissions)

**Via environment variables** - set `GOOGLE_API_KEY`, `ZAI_API_KEY`, or `OPENROUTER_API_KEY` in your shell. Environment variables override stored keys, so you can use them for temporary overrides or CI environments.

## Agent execution modes

Stargazer runs up to 5 review agents (lenses). How they run depends on your chosen mode:

**Parallel** - all lenses run at the same time. Faster, but needs a provider that handles concurrent requests. Gemini handles it, others might not.

**Sequential** - one lens at a time. Slower but works with any provider. This mode exists because some providers couldn't handle 5 parallel requests without dropping connections or hitting rate limits.

You can change this anytime in Settings > Analysis.

## Switching providers

Open Settings > Providers. You can:
- Add credentials for a new provider
- Switch the active provider
- Delete a provider's credentials
- Test that a provider is working

Your review history is independent of the provider, switching doesn't affect past reviews.

## Future providers

Planned:
- **Anthropic (Claude)** and **OpenAI** direct, no OpenRouter middleman
- **Local providers** (Ollama, LM Studio) for full privacy, nothing leaves your machine

---

[Back to README](../README.md)
