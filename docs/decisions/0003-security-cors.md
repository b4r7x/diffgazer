# ADR 0003: CORS Restricted to Localhost

## Status

**Accepted**

## Date

2025-01-20

## Context

Stargazer runs a local HTTP server for the CLI and web UI to communicate. We needed to decide on CORS (Cross-Origin Resource Sharing) policy.

### The DNS Rebinding Threat

In January 2024, **CVE-2024-28224** was disclosed for Ollama, a popular local LLM tool:

1. Ollama bound to `0.0.0.0:11434` with permissive CORS (`*`)
2. Attacker registered domain `evil.com` with A record `127.0.0.1`
3. Victim visited `evil.com` in browser
4. JavaScript on `evil.com` made requests to `localhost:11434`
5. Browser allowed requests due to permissive CORS
6. Attacker exfiltrated model data and executed commands

### Options Considered

1. **No CORS** (block all cross-origin): Too restrictive for web UI
2. **Permissive CORS** (`*`): Vulnerable to DNS rebinding
3. **Localhost-only CORS**: Balance of security and functionality

## Decision

Restrict CORS to localhost origins only:

```typescript
cors({
  origin: (origin) => {
    // Allow requests with no origin (same-origin, curl)
    if (!origin) return origin;

    try {
      const url = new URL(origin);
      const hostname = url.hostname;

      // Allow only localhost and 127.0.0.1
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return origin;
      }
    } catch {
      return "";
    }

    // Reject all other origins
    return "";
  },
  credentials: true,
})
```

### Defense in Depth

CORS is one layer of our security model:

| Layer | Protection |
|-------|------------|
| CORS | Block cross-origin requests |
| Host header validation | Block spoofed Host headers |
| 127.0.0.1 binding | Block network access |
| Session tokens | Block CSRF |

## Consequences

### Positive

1. **DNS rebinding protection**: Malicious sites cannot access our API
2. **Web UI works**: Legitimate localhost requests succeed
3. **CLI works**: Same-origin requests (no Origin header) succeed
4. **curl/Postman work**: No Origin header = allowed

### Negative

1. **No remote access**: Cannot access from other machines (by design)
2. **Port forwarding breaks**: SSH tunnels may have wrong Origin
3. **Browser extensions**: May need special handling

### Mitigation for Negative Cases

For legitimate remote access (rare for local tool):
- Use SSH with local port forwarding
- Or expose via reverse proxy with proper auth

## Security Analysis

### Attack Scenarios Blocked

| Scenario | Result |
|----------|--------|
| `evil.com` JavaScript | CORS blocks (origin not localhost) |
| DNS rebinding | CORS blocks + Host header blocks |
| iframe embedding | X-Frame-Options blocks |
| Direct curl from attacker | Cannot reach (127.0.0.1 binding) |

### Attack Scenarios NOT Blocked (Out of Scope)

| Scenario | Why Out of Scope |
|----------|------------------|
| Malicious browser extension | Full browser access, cannot defend |
| Compromised local machine | Game over regardless |
| Physical access | Game over regardless |

## References

- CVE-2024-28224: https://nvd.nist.gov/vuln/detail/CVE-2024-28224
- Ollama Security Advisory: https://github.com/ollama/ollama/security/advisories
- MDN CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- DNS Rebinding Attacks: https://en.wikipedia.org/wiki/DNS_rebinding
