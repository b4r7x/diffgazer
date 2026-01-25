# Phase 5: Security Review

**Agent**: `code-reviewer`
**Validation**: Manual review of findings
**Depends on**: Phases 1-4

## Overview

Security review of all new provider integration code.

## Scope

Review only new/modified files from this workflow:

| Package | Files |
|---------|-------|
| `packages/schemas` | `config.ts` (new types) |
| `packages/core` | `ai/sdk-client.ts`, `storage/openrouter-models.ts`, `secrets/index.ts` |
| `apps/server` | `api/routes/config.ts` |
| `apps/cli` | `hooks/use-openrouter-models.ts`, `components/wizard/*.tsx` |

## Security Checklist

### API Key Handling

- [ ] GLM API keys stored via existing secrets system (keyring → vault → env)
- [ ] OpenRouter API keys stored via existing secrets system
- [ ] No API keys logged in console or error messages
- [ ] No API keys included in HTTP responses
- [ ] Env var names are documented but values never exposed

### Network Security

- [ ] OpenRouter model fetch uses HTTPS only
- [ ] No credentials sent in URL query parameters
- [ ] API key sent in Authorization header, not URL

### File Security

- [ ] OpenRouter model cache file has restricted permissions (0o600)
- [ ] Cache file stored in user config directory (`~/.config/stargazer/`)
- [ ] No sensitive data in cache file (only model metadata)

### Input Validation

- [ ] Model IDs validated before passing to SDK
- [ ] GLM endpoint validated against enum
- [ ] Search queries sanitized (no injection risk in fetch URL)
- [ ] Zod schemas validate all API inputs

### Error Handling

- [ ] API errors don't leak sensitive info
- [ ] Network failures handled gracefully with fallback to cache
- [ ] Invalid API responses validated before use

## Review Tasks

### 5.1 Review SDK client changes

File: `packages/core/src/ai/sdk-client.ts`

Check:
- API key only passed to provider constructors
- No logging of config object with apiKey
- Error messages don't include API key

### 5.2 Review OpenRouter model fetcher

File: `packages/core/src/storage/openrouter-models.ts`

Check:
- Fetch uses HTTPS
- No auth required for public models endpoint
- Cache file permissions are 0o600
- Response data validated with Zod schema
- Error handling doesn't expose internal details

### 5.3 Review API routes

File: `apps/server/src/api/routes/config.ts`

Check:
- API key validation before storage
- No API key in responses (except confirmation message)
- OpenRouter model endpoint doesn't require auth (public data)
- Input validated with Zod before processing

### 5.4 Review CLI hooks

File: `apps/cli/src/hooks/use-openrouter-models.ts`

Check:
- No sensitive data in state
- Error messages safe to display
- No credentials in fetch calls (uses server endpoint)

### 5.5 Review env var handling

File: `packages/core/src/secrets/index.ts`

Check:
- Multiple env vars checked for GLM (GLM_API_KEY, ZHIPU_API_KEY)
- Env var names hardcoded, not dynamic
- No env var values logged

## Known Patterns to Preserve

From `.claude/docs/security.md`:

1. **CORS localhost only** - Existing middleware unchanged
2. **XML escaping in prompts** - Existing sanitization used
3. **Secrets hierarchy** - Keyring → vault → env (preserved)

## Findings Template

Report findings in this format:

```markdown
### Finding: [Title]

**Severity**: Critical / High / Medium / Low / Info
**File**: `path/to/file.ts:line`
**Description**: What the issue is
**Recommendation**: How to fix it
**Status**: Open / Fixed
```

## Expected Outcome

- No Critical or High severity findings
- Medium findings documented with mitigation
- Low/Info findings tracked for future improvement
