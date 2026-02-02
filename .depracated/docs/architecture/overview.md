# Architecture Overview

Stargazer is a local-only AI-powered code review tool built as a TypeScript monorepo.

## System Context

```
                          User
                           |
                           v
                    +--------------+
                    |  CLI (Ink)   |
                    |  - TUI       |
                    |  - Commands  |
                    +--------------+
                           |
                           | HTTP (localhost:3000)
                           v
                    +--------------+
                    | Server (Hono)|
                    | - REST API   |
                    | - SSE Stream |
                    +--------------+
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
    +-----------+    +-----------+    +-----------+
    |  AI API   |    |    Git    |    |  Storage  |
    | Gemini/   |    |   Repo    |    |  (Local)  |
    | OpenAI/   |    |           |    |           |
    | Anthropic |    |           |    |           |
    +-----------+    +-----------+    +-----------+
```

## Design Principles

### 1. Local-First

The server binds exclusively to `127.0.0.1`. No network exposure.

### 2. Type-Safe Error Handling

Use `Result<T, E>` for all fallible operations. Exceptions are reserved for programmer errors.

```typescript
// Good: Explicit error handling
const result = await parseConfig(raw);
if (!result.ok) {
  return handleError(result.error);
}
useValue(result.value);

// Avoid: Exception-based flow
try {
  const value = await parseConfig(raw);
} catch (e) {
  // Type information lost
}
```

### 3. Provider Abstraction

AI providers are abstracted behind `AIClient` interface. Users always select their provider.

### 4. Security by Default

- CORS: localhost only
- Prompts: XML-escaped user content
- Headers: X-Frame-Options: DENY, X-Content-Type-Options: nosniff

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| CLI UI | React 19 + Ink | Terminal interface |
| Server | Hono | HTTP API, SSE streaming |
| AI SDK | Vercel AI SDK | Multi-provider abstraction |
| Validation | Zod | Schema validation, type inference |
| Build | Turborepo + pnpm | Monorepo management |
| Testing | Vitest | Unit and integration tests |

## Key Architecture Decisions

| ADR | Decision | Rationale |
|-----|----------|-----------|
| 0001 | Result<T,E> over exceptions | Type safety, 300x faster |
| 0002 | Provider abstraction | Extensibility, user choice |
| 0003 | CORS localhost only | CVE-2024-28224 mitigation |
| 0004 | XML escape prompts | CVE-2025-53773 mitigation |
| 0005 | responseSchema for AI | Guaranteed valid JSON |

See [.claude/docs/decisions.md](../../.claude/docs/decisions.md) for full ADR details.

## Review System Architecture

### Lens-Based Reviews

```
              User Request
                   |
                   v
            +-------------+
            |   Triage    |
            |   Service   |
            +-------------+
                   |
        +----------+-----------+
        |          |           |
        v          v           v
   +--------+ +--------+ +--------+
   |Correct-| |Security| |  Perf  |
   | ness   | | Lens   | |  Lens  |
   +--------+ +--------+ +--------+
        |          |           |
        +----------+-----------+
                   |
                   v
            +-------------+
            |  Aggregate  |
            | Deduplicate |
            +-------------+
                   |
                   v
            +-------------+
            |   Filter    |
            | by Severity |
            +-------------+
                   |
                   v
            +-------------+
            |   Storage   |
            |   Save      |
            +-------------+
```

### Triage Types

| Type | Description |
|------|-------------|
| `TriageIssue` | Single issue with severity, category, location |
| `TriageResult` | Summary + array of issues |
| `DrilldownResult` | Deep analysis of specific issue |

### Severity Levels

| Level | Priority | Example |
|-------|----------|---------|
| `blocker` | 0 | Data corruption, infinite loops |
| `high` | 1 | Security vulnerability, incorrect results |
| `medium` | 2 | Edge case not handled |
| `low` | 3 | Minor issue, limited impact |
| `nit` | 4 | Style preference |

## Security

### Threat Model

| Vector | Risk | Mitigation |
|--------|------|------------|
| DNS Rebinding | HIGH | CORS localhost, Host header validation |
| Prompt Injection | HIGH | XML escaping, security instructions |
| Credential Theft | MEDIUM | OS keyring, file permissions (0600) |
| Clickjacking | LOW | X-Frame-Options: DENY |

### What We Skip (Intentionally)

These patterns add complexity without security benefit for a localhost-only tool:
- Redis rate limiting (in-memory suffices)
- Encrypted file storage (OS keyring is primary)
- TLS/HTTPS (no network transport)
- Authentication tokens (single local user)

## Cross-References

- [Monorepo Structure](./monorepo-structure.md) - Package organization
- [Data Flow](./data-flow.md) - Request/response flows
- [Security Reference](../../.claude/docs/security.md) - Detailed security docs
