# Security Architecture

> **Scope**: Stargazer is a **local-only CLI tool**. The server binds exclusively to `127.0.0.1` and is never exposed to the network.

---

## Threat Model

### Attack Surface

| Vector | Risk Level | Mitigation |
|--------|------------|------------|
| DNS Rebinding | **High** | CORS localhost restriction, Host header validation |
| Prompt Injection | **High** | XML escaping, security instructions in system prompt |
| Credential Theft | **Medium** | OS keyring, file permissions (0600), no network exposure |
| Clickjacking | **Low** | X-Frame-Options: DENY |
| XSS via MIME Sniffing | **Low** | X-Content-Type-Options: nosniff |

### Threat Actors

1. **Malicious Websites** - Browser tabs that attempt to interact with localhost services
2. **Malicious Diff Content** - Code changes containing embedded attack payloads
3. **Malicious AI Responses** - LLM outputs that leak credentials or inject content

---

## Implemented Protections

### 1. CORS Localhost Restriction

**CVE Reference**: [CVE-2024-28224](https://nvd.nist.gov/vuln/detail/CVE-2024-28224) (Ollama DNS Rebinding)

**Location**: `apps/server/src/app.ts`

The Ollama vulnerability demonstrated that local LLM tools without CORS restrictions are vulnerable to DNS rebinding attacks. A malicious website can:

1. Register a domain pointing to 127.0.0.1
2. Use browser JavaScript to send requests to localhost services
3. Exfiltrate data or execute commands

**Our Implementation**:
```typescript
cors({
  origin: (origin) => {
    if (!origin) return origin; // Allow same-origin, curl
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return origin;
    }
    return ""; // Reject all other origins
  },
  credentials: true,
})
```

### 2. XML Escaping for Prompt Injection Prevention

**CVE Reference**: [CVE-2025-53773](https://nvd.nist.gov/vuln/detail/CVE-2025-53773) (GitHub Copilot Chat)

**Location**: `apps/server/src/services/review.ts`

The GitHub Copilot vulnerability showed that unescaped content in structured prompts allows attackers to:

1. Embed `</code-diff>` in their code to escape the context
2. Inject new instructions that the LLM follows
3. Exfiltrate data through crafted responses

**Our Implementation**:
```typescript
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```

### 3. Security Headers

**Location**: `apps/server/src/app.ts`

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | DENY | Prevents clickjacking via iframe embedding |
| X-Content-Type-Options | nosniff | Prevents MIME type sniffing attacks |

---

## Planned Enhancements

### Host Header Validation

**Purpose**: Defense-in-depth against DNS rebinding

```typescript
// Reject requests with non-localhost Host headers
app.use("*", async (c, next) => {
  const host = c.req.header("host")?.split(":")[0];
  if (host && !["localhost", "127.0.0.1"].includes(host)) {
    return c.text("Forbidden", 403);
  }
  await next();
});
```

### CSRF Protection

**Purpose**: Prevent cross-site request forgery on state-changing endpoints

```typescript
import { csrf } from "hono/csrf";
app.use(csrf());
```

### Unicode Sanitization

**Purpose**: Remove invisible characters used in prompt injection attacks

**Evidence**: Keysight ATI-2025-08, Trend Micro 2025 research, OWASP LLM Top 10

```typescript
function sanitizeUnicode(s: string): string {
  return s
    // Zero-width characters (legacy attacks)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Unicode tags (PRIMARY 2025 vector - encodes hidden ASCII)
    .replace(/[\uE0000-\uE007F]/g, "")
    // Bidirectional overrides (text direction manipulation)
    .replace(/[\u202A-\u202E]/g, "")
    // Variation selectors (emoji smuggling)
    .replace(/[\uFE00-\uFE0F]/g, "");
}
```

### Credential Exposure Warning

**Purpose**: Detect accidental API key leakage in AI responses

**Evidence**: AssemblyAI key exposure incident, OWASP LLM07:2025

```typescript
const CREDENTIAL_PATTERNS = [
  /sk-ant-[a-zA-Z0-9-]+/g,           // Anthropic
  /sk-[a-zA-Z0-9]{48}/g,              // OpenAI
  /AIza[0-9A-Za-z_-]{35}/g,           // Google
  /ghp_[a-zA-Z0-9]{36}/g,             // GitHub
];

function warnIfCredentialsExposed(output: string): void {
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(output)) {
      console.warn("[SECURITY] Potential credential detected in AI response");
      break;
    }
  }
}
```

---

## What We Intentionally Skip

These patterns add complexity without security benefit in a single-user, single-process, localhost-only context:

| Pattern | Why Not Applicable |
|---------|-------------------|
| Redis-backed rate limiting | Single-instance local process; in-memory limits suffice |
| Encrypted file storage | OS keyring is primary; file fallback uses filesystem permissions |
| TLS/HTTPS | Localhost-only; no network transport |
| Authentication tokens | Single user, local process |
| WAF / Input sanitization | Trusted local user input |

---

## Verification Checklist

```bash
# Test CORS restriction
curl -H "Origin: https://evil.com" -v http://localhost:3000/

# Test Host header validation (after implementation)
curl -H "Host: evil.com" http://localhost:3000/
# Expected: 403 Forbidden

# Test XML escaping
# Include "</code-diff>" in a diff and verify it's escaped
```

---

## References

1. CVE-2024-28224 - Ollama DNS Rebinding: https://nvd.nist.gov/vuln/detail/CVE-2024-28224
2. CVE-2025-53773 - GitHub Copilot Prompt Injection: https://nvd.nist.gov/vuln/detail/CVE-2025-53773
3. OWASP LLM Top 10: https://owasp.org/www-project-top-10-for-large-language-model-applications/
4. Unicode Tag Attacks (Keysight ATI-2025-08): Research on invisible character injection
5. Trend Micro 2025 LLM Security Research: Prompt injection via Unicode manipulation
