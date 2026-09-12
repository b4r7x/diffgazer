# diffgazer

## 0.3.0

### Minor Changes

- ffecd28: Command Code joins the provider list. It is the Command Code Provider API — an OpenAI-compatible gateway billed through a coding plan or pay-as-you-go credits — configured with a `COMMAND_CODE_API_KEY` credential. The model picker is the provider's own live list: every model served on the OpenAI-compatible endpoint is offered; Claude models are not, because they require the Anthropic Messages endpoint. Command Code publishes no per-model prices, so rows show their context size and "pricing unknown" rather than a price badge. Zero-data-retention routing is not requested: the notice discloses the provider's default 30-day retention. A model outside your plan is refused by the provider when the review is sent, and that refusal now reads as a plan problem with the remedies named — choose another model, upgrade the plan, or add pay-as-you-go credits — instead of a generic access error.

## 0.2.0

### Minor Changes

- 24411b0: Audit pass on the `diffgazer` CLI. Reworks the embedded/web/process server launchers and their factories for cleaner startup and shutdown, refines the terminal theme provider and severity colors, and tightens the web launcher and TUI entry. The TUI `--theme` option now accepts only `auto`, `dark`, `light`, or `high-contrast`; unsupported values fail validation instead of falling back to `dark`.

  Reconstructed retroactively from the post-0.1.4 history; these changes predate the changeset-based flow.

- 20b6d17: A run that ends early no longer ends empty. When a session is terminated mid-review the
  server saves what the run already found, and the live screen offers "View Saved Run" to
  open that record instead of dropping you back at the start. Model answers that arrive
  truncated or malformed are salvaged issue by issue, so the findings that stand on their
  own survive an answer that did not.

  A run that finishes clean now gets a receipt rather than a blank screen: both the web app
  and the TUI show what was reviewed, by which model, and how long it took, and the history
  row reads "Passed with no issues." only when every lens actually reported.

  Reviews that wait a long time on a slow model no longer die to the HTTP client's own fixed
  300-second ceiling before their own deadline is reached: each dispatch runs on a pooled
  connection whose response timeouts are sized to that dispatch's wall, so the timeout that
  fires is the one the diagnostic names.

- 2e7995d: OpenCode's two billing pools — Zen credits and the Go subscription — are now an explicit
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

- b5863e5: The model picker's filters now sit in one header row on both surfaces: the `[Zen] [Go]`
  pool tabs and the `[All] [Free] [Paid]` tier filter render side by side between the search
  box and the list. The pool tabs filter the list — the active tab shows only the models its
  pool serves — so the per-row pool badges are gone from both pickers; the tab itself names
  the pool a save bills. When the saved model is not served by the active tab, an inline
  notice names it and the tab that serves it, and the check comes back when that tab does;
  a confirm only ever saves a visibly selected row. Provider names get a short form where
  space is tight: "OpenCode · Zen", "OpenCode · Go", "Qwen" in headers, list rows, and
  picker subtitles, while detail panes, receipts, and history keep the full product name.
- 2e7995d: The OpenCode pool now travels with the model. Both model pickers list the union of what Zen
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

- 435a938: Widen the provider roster and make model selection reflect what each provider actually
  offers. MiniMax joins the catalog, and DeepSeek, Qwen, and Moonshot are selectable again.
  Model lists are now fetched live from each provider's own API rather than a single shared
  listing, so the models you can pick match the key you configured. Free-tier models are
  handled end to end — selection, review execution, and results — instead of failing part
  way through. Errors across the CLI now share one presentation: the same shape, wording,
  and severity colors wherever they surface.
- 2e7995d: A lens whose model answer arrived incomplete — the findings that parsed were kept, the
  rest of the candidates dropped — no longer passes for a full answer. Every surface now
  says so: the summary headline reads "Review Partially Complete", the per-lens list shows
  how many candidate findings were dropped, a run-level notice names the incomplete answers
  and suggests a rerun, and the history sentence reads "Partial answers" instead of a clean
  verdict. A run containing such a lens never earns the unqualified "Passed — no issues
  found" screen. Reviews saved before this change load and render exactly as they did.
- 0e78f7d: On OpenRouter and OpenCode Zen, a dispatch that sends no response headers, or only
  keep-alive filler, for the idle budget is given up on and re-dispatched once inside the
  same wall. Four flash models that think by default — `qwen3.8-flash`, `glm-5.3-flash` and
  `deepseek-v4-flash` on OpenCode Zen, `glm-5.3-flash` on Z.AI — now get a reasoning cap on
  the wire, so those reviews finish in seconds rather than minutes; OpenRouter's reasoning
  routes carry a token bound of their own. A new `reviewWallTimeCapMs` setting caps a
  review's total wall clock. A batch that fails on a timeout, a 5xx or a rate limit is
  retried once while the review clock still fits a dispatch, and a re-queued batch no longer
  shows up as a failed lens. A cancelled review is readable as a saved run the moment the
  cancel returns, lens errors carry their diagnostic code, and Ollama Cloud's billing text
  matches its published rates. Requests to OpenCode Zen and Go now identify this client and carry one session id per review, as OpenCode asks of every client.

### Patch Changes

- 2924d02: The provider consent's "Privacy notes" link, in both the web dialog and the terminal
  card, points at the docs site's privacy page, https://docs.diffgazer.b4r7.dev/privacy.
- 3e5d1f8: Harden the public packages before release. `dgadd` now validates Tailwind v4 and
  source aliases before writing files, keeps integration-mode migrations
  transactional, and restores package and manifest state after failures.

  The UI library fixes form, focus, keyboard, SSR, and accessibility behavior. It
  also normalizes an empty single Accordion value to `undefined` and removes the
  unused `MenuItemRadio` `value` prop. The keys library fixes focus restoration
  and traps across owner documents and shadow roots, and prevents action-row focus
  repair from stealing focus.

  The `diffgazer` CLI improves startup and shutdown handling, development port
  propagation, terminal input routing, TUI navigation, and bundled license
  notices.

- 929ad7c: Raise the security floors on the server dependencies bundled into the CLI. `hono`
  moves to `^4.12.34` (CORS middleware ReDoS, GHSA-8j4g-w8fx-2239) and
  `@hono/node-server` to `^2.0.12` (Windows `serve-static` path traversal through an
  encoded backslash that bypassed route middleware, GHSA-frvp-7c67-39w9, patched
  only on the 2.x line). Both ship inside the `diffgazer` binary: the embedded
  server uses `hono/cors`, and web mode serves the SPA through `serveStatic`. The
  `@hono/node-server` 2.0.0 breaking changes do not reach this package — it dropped
  Node 18 (this package already requires Node >= 22) and removed the unused Vercel
  adapter. No API or behavior change.
- e0094af: UI improvements pass across the published surfaces, with the audit fixes that came with it.

  `@diffgazer/keys` now describes its copy targets as `@hooks/...` alias tokens instead of hardcoded
  `src/` paths, matching the `@ui/...` form `@diffgazer/ui` already used, so a copied file lands under
  the consumer's own configured source root. Its `navigation` item also copies the `hotkey` helper it
  depends on. `@diffgazer/ui` moves the shared `stepper.css` out of the `stepper` and
  `horizontal-stepper` file lists into the `stepper-variants` item both already depend on, so
  installing either surface brings the stylesheet exactly once, and `toast` picks up a `focus-restore`
  dependency on `@diffgazer/keys`. Both libraries ship correctness, accessibility, and focus fixes
  across their components, hooks, and utilities.

  `@diffgazer/add` resolves those alias targets by reading the consumer's Vite and tsconfig alias
  configuration, and reworks `remove` so cascade removal and CSS chunk cleanup follow the dependency
  edges recorded at install time rather than the live registry.

  `diffgazer` restyles the TUI panes, menus, and filters, fixes keyboard navigation and focus escaping
  in the onboarding and provider flows, and corrects the review and context colors.

  `@diffgazer/ui` public API:

  Removals:
  - `HorizontalStepperProps.steps` — the run is now derived from the rendered `HorizontalStepper.Step`
    children, which register themselves in document order. Drop the prop; the steps you render are the
    run.
  - `CommandPaletteItemMetadata` — folded into `CommandPaletteItemRegistration`, which carries the same
    fields directly.

  Changes:
  - `ToggleGroupProps` and `CheckboxGroupProps` are no longer generic. For a value-typed toggle group,
    build one with `createToggleGroup(values)`; `CheckboxGroup` values are `string[]`.
  - `DialogContentProps` is a discriminated union on `modal`: a modal dialog takes `modal?: true` with
    `role`, `closeIcon`, `closeOnBackdropClick`, `initialFocus`, `onCancel`, and `onEscapeKeyDown`, and
    an inline dialog takes `modal: false` and accepts none of them.
  - `DiffViewProps.statusBar` is accepted only with `variant="statusbar"`; on every other variant it is
    now typed `never` instead of being silently ignored.

## 0.1.4

### Patch Changes

- 6416350: Documentation and release-tooling release. This version was never published to
  npm; its changes — including the CLI flag surface (`--version`, `--help`, `--tui`,
  `--theme`) that 0.1.3 did not have — ship with the next release. The install and
  first-review guides were expanded and the published package surface is now validated
  before every release.

## 0.1.3

Reconstructed retroactively; this version predates the changeset-based flow.

- Fix embedded server issues affecting CLI startup.
- Fix onboarding settings refresh after configuration changes.
- Update README, logo, and demo assets.

## 0.1.2

Reconstructed retroactively; this version predates the changeset-based flow. It was
published to npm but never tagged in git; its changes are attributed from the
`v0.1.1..v0.1.3` range.

- Fix keyring credential handling.

## 0.1.1

Reconstructed retroactively; this version predates the changeset-based flow. Initial
official `diffgazer` release.

- Launch the Diffgazer environment from the CLI: in production, run the embedded server
  and serve the static web app; in development, spawn the API server and web frontend with
  HMR.
