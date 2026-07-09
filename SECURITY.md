# Security Policy

Report suspected vulnerabilities privately through GitHub private vulnerability
reporting:

https://github.com/b4r7x/diffgazer/security/advisories/new

If you cannot use GitHub advisories, email b4r7dev@gmail.com instead. Do not open
public issues for vulnerabilities. Include affected package names, versions,
reproduction steps, and impact.

## Local API server token gate

The embedded API server (the `diffgazer` CLI's web mode) gates every `/api/*`
route except `/api/health` and CORS preflight (`OPTIONS`) requests behind a
session token (`DIFFGAZER_SHUTDOWN_TOKEN`).

Every request (not just `/api/*`) must carry a localhost `Host` header
(`localhost`, `127.0.0.1`, or `::1`); anything else is rejected with `403`.
Origin handling is method-dependent: foreign-origin (non-localhost) `/api/*`
requests are rejected with `403` only for unsafe methods (`POST`, `PUT`, `PATCH`,
`DELETE`). A safe foreign-origin `GET` is not blocked at the edge, but CORS
withholds the
`Access-Control-Allow-Origin` response header (same-origin only when packaged,
any localhost origin in split dev), so a browser on a foreign origin cannot read
the response body.

- **Packaged mode** (the published `diffgazer` binary): the CLI always injects a
  token, so the gate is always enforced.
- **Split dev** (running the server outside the CLI with no token set): the gate
  is disabled and any localhost origin can reach most of `/api/*`. The residual
  exposure is a hostile page loaded from a localhost origin on the developer's
  own machine. The server logs a `warn`-level startup line
  (`api_token_gate_disabled`) whenever it starts in this mode. The
  `/api/settings/trust` routes are the exception: they always require the token
  and fail closed with `401` when none is configured, even in split dev.

To require the token even in split dev, set `DIFFGAZER_SHUTDOWN_TOKEN` before
starting the server; the gate is then enforced in every mode.
