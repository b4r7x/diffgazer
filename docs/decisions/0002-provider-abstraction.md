# ADR 0002: Provider Abstraction and Selection UI

## Status

**Accepted**

## Date

2025-01-20

## Context

Stargazer integrates with AI providers (Anthropic, OpenAI, Google) for code review. We needed to decide:

1. Should we hardcode a single provider or abstract multiple?
2. Should users explicitly select providers or auto-detect?
3. How complex should the provider interface be?

### Current State of AI Tooling

The AI ecosystem is rapidly evolving:

| SDK/Framework | Approach | Providers |
|---------------|----------|-----------|
| Vercel AI SDK | Unified interface | 15+ |
| LangChain | Provider-agnostic | 50+ |
| LiteLLM | OpenAI-compatible proxy | 100+ |

### User Needs

Different users have different requirements:

- **Cost**: Claude vs GPT-4 vs Gemini have different pricing
- **Privacy**: Some users prefer local models (Ollama)
- **Capability**: Models have different strengths for code review
- **Compliance**: Enterprise users may require specific providers

## Decision

1. **Abstract providers** behind a common `AIClient` interface
2. **Explicit selection UI** during onboarding and available in settings
3. **Simple interface** focused on streaming text generation

### Provider Interface

```typescript
interface AIClient {
  generateStream(
    prompt: string,
    callbacks: StreamCallbacks
  ): Promise<void>;
}

interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}
```

### Provider Selection UI

Even with only one provider configured, we show a selection screen because:

1. **User awareness**: Users should know which AI is reviewing their code
2. **Future-proofing**: Adding providers requires no UI changes
3. **Explicit consent**: Each review session explicitly chooses a provider

### Planned Providers

Current:
- Anthropic Claude
- OpenAI GPT-4
- Google Gemini

Planned:
- Ollama (local)
- Azure OpenAI
- AWS Bedrock
- Custom OpenAI-compatible endpoints

## Consequences

### Positive

1. **Extensibility**: New providers require only adapter implementation
2. **User control**: Explicit choice over AI provider
3. **Testing**: Can mock providers for testing
4. **Cost optimization**: Users can choose cost-effective providers

### Negative

1. **Extra step**: Users must select provider even when only one exists
2. **Abstraction overhead**: Simple interface may not expose all provider features
3. **Maintenance**: Each provider adapter needs updates for API changes

### Neutral

1. **Similar to industry**: Aligns with Vercel AI SDK, LangChain patterns
2. **Migration path**: Can adopt Vercel AI SDK later if needed

## Alternatives Considered

### 1. Hardcode Single Provider

**Rejected** because:
- Locks users into one vendor
- Prevents cost optimization
- No path to local/private models

### 2. Auto-detect Based on API Keys

**Rejected** because:
- Implicit behavior confuses users
- No control over which provider is used
- Harder to debug issues

### 3. Use Vercel AI SDK Directly

**Considered for future** because:
- Adds dependency
- May be overkill for simple streaming use case
- Can migrate to it later if needed

## References

- Vercel AI SDK: https://sdk.vercel.ai/
- LangChain: https://langchain.com/
- LiteLLM: https://litellm.ai/
- Ollama: https://ollama.ai/
