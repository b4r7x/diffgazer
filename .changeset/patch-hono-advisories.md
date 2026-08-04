---
"diffgazer": patch
---

Patch two advisories in the server stack bundled into the `diffgazer` binary. `hono` moves to
`^4.12.34` for the CORS middleware ReDoS (GHSA-8j4g-w8fx-2239) — `cli/server` mounts `hono/cors`, so
the vulnerable matcher shipped inside the binary. `@hono/node-server` moves to `^2.0.12` for the
Windows `serve-static` path traversal via an encoded backslash (GHSA-frvp-7c67-39w9, patched only on
the 2.x line), which the embedded web mode reaches through `serveStatic`. The 2.0.0 breaking changes
do not apply here: it dropped Node 18 (this CLI requires Node >= 22) and removed the unused Vercel
adapter. No command surface, API, or behavior changes.
