# Security Policy

Report suspected vulnerabilities privately to b4r7dev@gmail.com. Do not open
public issues for vulnerabilities. Include affected package names, versions,
reproduction steps, and impact.

GitHub private vulnerability reporting is currently disabled for this repository.
If the maintainer enables it later, GitHub advisories can be used as an
alternative private channel.

## Local API server token gate

The embedded API server (the `diffgazer` CLI's web mode) gates every `/api/*`
route except `/api/health` behind a session token (`DIFFGAZER_SHUTDOWN_TOKEN`).
Requests are additionally restricted to localhost hosts and same-/localhost
origins.

- **Packaged mode** (the published `diffgazer` binary): the CLI always injects a
  token, so the gate is always enforced.
- **Split dev** (running the server outside the CLI with no token set): the gate
  is disabled and any localhost origin can reach `/api/*`. The residual exposure
  is a hostile page loaded from a localhost origin on the developer's own
  machine. The server logs a `warn`-level startup line
  (`api_token_gate_disabled`) whenever it starts in this mode.

To require the token even in split dev, set `DIFFGAZER_SHUTDOWN_TOKEN` before
starting the server; the gate is then enforced in every mode.
