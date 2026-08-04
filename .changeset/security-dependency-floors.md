---
"diffgazer": patch
---

Raise the security floors on the server dependencies bundled into the CLI. `hono`
moves to `^4.12.34` (CORS middleware ReDoS, GHSA-8j4g-w8fx-2239) and
`@hono/node-server` to `^2.0.12` (Windows `serve-static` path traversal through an
encoded backslash that bypassed route middleware, GHSA-frvp-7c67-39w9, patched
only on the 2.x line). Both ship inside the `diffgazer` binary: the embedded
server uses `hono/cors`, and web mode serves the SPA through `serveStatic`. The
`@hono/node-server` 2.0.0 breaking changes do not reach this package — it dropped
Node 18 (this package already requires Node >= 22) and removed the unused Vercel
adapter. No API or behavior change.
