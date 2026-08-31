---
"diffgazer": minor
---

OpenCode's two billing pools — Zen credits and the Go subscription — are now an explicit
choice rather than a silent default. Creating an opencode configuration asks which endpoint
to bind, and the configuration summary names the bound pool and its URL, so a key that
spends Go credit is never mistaken for one that spends Zen credit. Re-keying an existing
configuration shows that endpoint read-only and keeps it.

Moonshot gets the same question for a different reason: its two endpoints are regions, not
pools, so creating a Moonshot configuration now asks for International or Mainland China, and
that choice is likewise fixed once the configuration exists.

Quota and billing failures name the pool that reported them instead of the product, and when
the model is also served by the other pool the diagnostic says so. Products with a single
endpoint are untouched: same lists, same messages, same payloads as before.
