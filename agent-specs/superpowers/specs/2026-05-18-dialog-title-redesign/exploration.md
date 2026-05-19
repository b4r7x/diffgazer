# Dialog title redesign — exploration

**Status:** in progress · variant catalog · awaiting final pick
**Owner:** `b4r7x`
**Touches:** `libs/ui/registry/ui/dialog/`, `libs/ui/styles/theme.css`
**Preview:** `tmp/dialog-variants-preview.html`

## Context

The `DialogTitle` primitive currently renders as:

```text
┌─ ✦ Apply Patch ✦ ────────────────────┐
```

with the title in gold (`--warning`), sparkle decorations, and pseudo
corner-brackets that are nested **inside** a real 1px CSS border on
`DialogContent`. The result reads as AI-slop ("premium AI sparkle vibe"),
the frame is visually broken (two top edges), and the keyboard hints
(`[Esc] Close`) double-encode the bracket-button CTAs (`[Cancel]`).

Files in scope:

- `libs/ui/registry/ui/dialog/dialog-title.tsx` — title render
- `libs/ui/registry/ui/dialog/dialog-content.tsx` — outer border / shell
- `libs/ui/styles/theme.css` — `--warning`, `--border`, `--action`
- Consumers: `apps/web/src/features/providers/{api-key-dialog,model-select-dialog}/`

## Diagnosed slop

1. `✦` sparkle decorations around the title.
2. Gold (`--warning`) on the title itself for a non-warning dialog.
3. Pseudo top-corners (`┌─ ─┐`) rendered as text inside a real CSS border —
   the box has two visible top edges that don't line up.
4. Hot-key hints (`[Esc] Close`) plus bracket buttons (`[Cancel]`) say the
   same thing twice.
5. Two visual vocabularies fighting: monospace TUI box-drawing chars +
   web-style pill `Kbd` chips.

## Constraints

- Keep monospace identity — the product is TUI-flavored.
- Keep `--tui-*` theme tokens; do not introduce new colors.
- Must work for `Dialog` (info / confirm / alert) and `Dialog` with
  `role="alertdialog"` for destructive actions.
- Pixel-perfect across font-rendering targets (no relying on the glyph
  metrics of `┌┐└┘│─` aligning with CSS borders — they don't).
- Public API of `DialogTitle` stays: `children`, `as`, `decorated`.
- Body / footer / kbd / button styling out of scope for this pass.

## Variant catalog (chronological)

| # | Name | Mechanism | Verdict |
|---|---|---|---|
| V0 | Current | Text-art `┌─ ✦ Title ✦ ─┐` inside CSS border | slop · rejected |
| V1 | Clean & minimal | Plain title + 1px bottom rule | meh — too generic |
| V2 | **Vertical marker** | 4px CSS bar before title + optional meta tag | **★ kept** |
| V3 | True corner brackets (v1) | Text-art `┌─┐│└─┘` whole frame, no outer border | aesthetic good, alignment broken |
| V4 | Tinted header band | `bg-secondary` header band + bottom rule | meh — shadcn-generic |
| V5 | Viewfinder (v1) | 4 corner glyphs inset 6–8px inside dialog | corners floated inside, weak without context |
| V6 | Notched title tab (v1) | Text-art frame + `┤ Title ├` notch | same alignment break as V3 |
| V7 | Status stripe | 3px full-height left accent (severity color) | nice but reads like a toast, not a modal |
| V8 | Section divider | `── Title ────────` rule, no frame | too quiet for a modal |
| V3′ | Corner brackets (FIXED) | 1px CSS border + 18px / 2px CSS accent corners | clean, ranked alongside V9 |
| V6′ | Notched title tab (FIXED) | V3′ frame + absolute-positioned tab masking border | works but adds a third visual layer |
| V9 | **Hybrid (V2 + V3′)** | V3′ corners + V2 bar | **★ kept** |
| V10 | Tactical bold | 26px / 3px / yellow CSS corners + V2 bar | severity-aware, possibly too loud for default |
| V5a | Viewfinder · subtle | 12px / 1.5px / dim corners at outer edges | candidate |
| V5b | Viewfinder · standard | 20px / 2px / fg corners at outer edges | candidate |
| V5c | Viewfinder · bold | 28px / 3px / fg corners at outer edges | candidate |
| V5d | Viewfinder · sticking out | 20px / 2px / fg corners at −3px offset (outside) | candidate |

## Two architectures

The catalog splits into two structural approaches. They are not
interchangeable; picking one fixes the dialog frame too.

### Architecture A — bordered frame + accent corners

- Real CSS rectangular border on `DialogContent`.
- Title bar is internal content above body.
- Optional CSS pseudo-element accent corners on top of the border (V9 / V10).
- **Pros:** unambiguous dialog boundary, accessible focus ring still
  reads, severity color can layer on top.
- **Cons:** the rectangle reads "shadcn modal" — less distinctive.

Variants in this family: **V2**, **V9**, **V10**.

### Architecture B — viewfinder (corners only)

- `DialogContent` has NO border.
- 4 CSS-drawn corner accents at the outer edges (or just outside).
- The scrim / modal backdrop carries the boundary; the corners frame the
  region of interest.
- **Pros:** distinctive, evocative of "framing changes" — fits a diff
  tool semantically; no chrome competing with body content.
- **Cons:** without a strong scrim the dialog floats; harder to render
  outside a real modal context.

Variants in this family: **V5a / V5b / V5c / V5d**.

## Decision matrix

| Criterion | V2 | V9 | V10 | V5b | V5c | V5d |
|---|---|---|---|---|---|---|
| Boundary clarity | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 |
| Brand identity | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Severity-color ready | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Implementation complexity | low | low | low | low | low | low |
| Visual weight | quiet | medium | loud | quiet | medium | medium |
| Reads outside modal scrim | ✅ | ✅ | ✅ | ❌ | 🟡 | 🟡 |

## Implementation outline (any winner)

1. **`dialog-title.tsx`** — replace the text-art title render. Strip
   sparkle + gold default. Title color is `--fg`. The `decorated` prop
   becomes a visual choice (bar / no bar) rather than a frame switch.
2. **`dialog-content.tsx`** — for Architecture B winners, drop the
   `border border-border` and add the corner-accent pseudo-elements via
   a child `<span aria-hidden>`. For Architecture A winners, keep the
   border and add the pseudo-element corner accents.
3. **`dialog-footer.tsx`** — out of scope for this pass; the kbd chips
   and bracket buttons stay as-is (separate decision: kbd-or-brackets,
   not both).
4. **Theme tokens** — no new tokens needed; pick from `--fg`, `--border`,
   `--warning`, `--error` for severity.
5. **Tests** — update `dialog.test.tsx` snapshots/assertions for the new
   title structure. Behavior tests (open/close, focus trap, ARIA labels)
   are unaffected.
6. **Registry sync** — regenerate `libs/ui/public/r` for the dialog
   component family. Refresh copy-mode and package consumers.
7. **App consumers** — `api-key-dialog`, `model-select-dialog`: should
   need no source changes since they consume `<Dialog.Title>{children}`.

## Verification plan

- `pnpm --filter @diffgazer/ui type-check`
- `pnpm --filter @diffgazer/ui test --run dialog`
- `pnpm --filter @diffgazer/web type-check`
- Manual: open the api-key and model-select dialogs in the web app and
  verify the new title reads correctly in dark + light themes.
- `pnpm run prepare:artifacts && pnpm run validate:artifacts:check`
  before committing the registry sync.

## Open question (blocks decision)

Pick one winner from the decision matrix. The winner determines
Architecture A vs B and locks the surrounding `DialogContent` change.
