---
"diffgazer": minor
---

The OpenCode pool now travels with the model. Both model pickers list the union of what Zen
credits and the Go subscription serve — the 13 Go-only models that used to be listed nowhere
are selectable. `[Zen] [Go]` tabs filter the list to the models the active pool serves —
the 17 models both pools serve appear under both tabs — and the active tab is the wallet a
save bills. Confirming a row saves the model and its pool together, so a Go allowance that runs
out mid-session is answered by picking the same model on Zen credits, without re-entering a
key. Creating a configuration still binds an endpoint and re-keying one still shows it
read-only; the pool moves from the picker now, not from the credential dialog. Quota and
access failures name the pool that reported them and point back at Select Model. Products
with a single endpoint, and Moonshot's two regions, are untouched.

Two things this does not do. History rows keep the product name they were written with:
receipts have stored the endpoint all along, but no row is relabeled retroactively. And the
pre-run cost reservation still quotes Zen pay-as-you-go prices for a Go run — deliberately,
because the reservation is a worst-case ceiling rather than a charge, and over-reserving
against a subscription errs safe.

Go-only models are offered to every key, because whether a key is entitled to the Go pool is
not knowable before the call.
