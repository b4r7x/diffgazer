# Security Reference

## Threat Model

Stargazer is a **local-only CLI tool**. Server binds to `127.0.0.1` only.

| Vector | Risk | Mitigation |
|--------|------|------------|
| DNS Rebinding | HIGH | CORS localhost restriction, Host header validation |
| Prompt Injection | HIGH | XML escaping, security instructions in system prompt |
| Credential Theft | MEDIUM | OS keyring, file permissions (0600) |
| Clickjacking | LOW | X-Frame-Options: DENY |
| MIME Sniffing | LOW | X-Content-Type-Options: nosniff |

---

## Implemented Protections

### CORS Localhost Restriction
**CVE**: CVE-2024-28224 (Ollama DNS Rebinding)

Location: `apps/server/src/app.ts`

Only allow `localhost` and `127.0.0.1` origins. Reject all others.

### XML Escaping
**CVE**: CVE-2025-53773 (GitHub Copilot Prompt Injection)

Location: `apps/server/src/services/review.ts`

Escape `<`, `>`, `&` in user content before embedding in prompts.

### Security Headers
Location: `apps/server/src/app.ts`

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

---

## What We Skip (Intentionally)

Not applicable for localhost-only tool:
- Redis rate limiting (in-memory suffices)
- Encrypted file storage (OS keyring + file permissions)
- TLS/HTTPS (no network transport)
- Authentication tokens (single local user)
- WAF (trusted local input)

---

## Verification Commands

```bash
# Test CORS
curl -H "Origin: https://evil.com" -v http://localhost:3000/

# Test Host header (if implemented)
curl -H "Host: evil.com" http://localhost:3000/
# Expected: 403 Forbidden
```

---

## CVE References

- CVE-2024-28224: https://nvd.nist.gov/vuln/detail/CVE-2024-28224
- CVE-2025-53773: https://nvd.nist.gov/vuln/detail/CVE-2025-53773
- OWASP LLM Top 10: https://owasp.org/www-project-top-10-for-large-language-model-applications/
