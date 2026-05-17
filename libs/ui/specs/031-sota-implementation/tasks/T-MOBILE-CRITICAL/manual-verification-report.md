---
title: T-MOBILE-CRITICAL — Manual iOS / Mobile Verification Report
task: T-MOBILE-CRITICAL
brief: ./brief.md
status: PENDING (template — fill in on real hardware)
---

# T-MOBILE-CRITICAL — Manual iOS / Mobile Verification Report

This is a TEMPLATE. Run every step on the real devices listed in the matrix and tick each checkbox only after observing the described behavior. Do not pre-tick anything. Capture the build SHA at the bottom so the verification is tied to a specific commit.

- Brief: [./brief.md](./brief.md)
- Acceptance criteria source: `libs/ui/specs/031-sota-implementation/tasks/T-MOBILE-CRITICAL/brief.md` (sections NEW-022, NEW-023, NEW-024)

## Test build setup

Before running any test step:

1. Check out the build SHA recorded at the bottom of this report.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm --filter @diffgazer/docs build` and serve the built docs site on a LAN-reachable host (`pnpm --filter @diffgazer/docs preview --host 0.0.0.0`).
4. On each device under test, navigate Safari to the LAN URL of the docs site. Do not use desktop devtools emulation — emulators do not reproduce the iOS Safari font-zoom bug (NEW-023) or true touch behavior (NEW-022).
5. Open the relevant primitive demo page for each criterion (popover/tooltip page for NEW-022, input/textarea page for NEW-023, dialog page for NEW-024).

---

## NEW-022 — Popover/Tooltip hover-mode reachable on touch

### Acceptance criteria (verbatim from brief.md)

- [ ] Popover hover-mode with non-interactive child responds to tap (opens on tap-down, closes on outside tap or second tap)
- [ ] Tooltip is reachable on touch — either via long-press (300-500ms) OR by switching to `aria-describedby` static visible behavior on touch devices
- [ ] Tests cover: touch tap-open, second-tap-close, outside-tap-close
- [ ] No regression on desktop hover behavior

### Manual test steps

Run each step on the device under test. Mark PASS only if the observed behavior matches the expectation exactly.

1. Open the popover demo page that uses a non-interactive child (a plain `<span>` or `<div>` trigger).
2. Tap the trigger once. Confirm the popover content becomes visible. PASS if visible within 500ms of tap-down.
3. With the popover open, tap the trigger again. Confirm the popover closes. PASS if it closes without requiring a tap elsewhere.
4. Reopen the popover. Tap a point outside both the trigger and the popover surface. Confirm the popover closes.
5. Open the tooltip demo page.
6. Long-press the tooltip trigger for at least 400ms without moving the finger. Confirm the tooltip appears. PASS if it appears within 600ms of touch-down.
7. Release the long-press. Confirm the tooltip dismisses on touch-end OR remains visible until next tap (whichever the implementation documents).
8. Tap the trigger briefly (<200ms). Confirm a short tap does NOT trigger the long-press tooltip.
9. Scroll the page during a long-press. Confirm the tooltip does NOT open (scroll cancels the timer).
10. Confirm no double-tap zoom is triggered by the tap that opens the popover/tooltip.

### Pass/fail checklist

- [ ] Popover opens on single tap of non-interactive trigger
- [ ] Popover closes on second tap of same trigger
- [ ] Popover closes on outside tap
- [ ] Tooltip appears after 300-500ms long-press
- [ ] Short tap does NOT open tooltip
- [ ] Scroll during long-press cancels tooltip
- [ ] No double-tap zoom artifact triggered by any of the above interactions

---

## NEW-023 — iOS Safari input zoom does not trigger on focus

### Acceptance criteria (verbatim from brief.md)

- [ ] Input/Textarea at `sm` and `md` variants render with computed font-size ≥ 16px **on viewports ≤ 768px wide** (use `@media (max-width: 768px)` or media query inside `input-variants.ts` class strings)
- [ ] Desktop (>768px) `sm`/`md` remain visually compact (12-14px is OK there)
- [ ] Existing input tests pass
- [ ] iOS Safari focus-zoom does not trigger (manual verification step documented in report)

### Manual test steps

Run each step on the device under test in portrait orientation first, then repeat in landscape if landscape width is ≤ 768px.

1. Open the input demo page. Confirm at least one `sm` variant input and one `md` variant input are visible.
2. Note the current viewport zoom level (should be 1.0). Take a screenshot before focus.
3. Tap the `sm` variant input to focus it. Observe the viewport zoom level. PASS if the zoom level remains 1.0 — no zoom-in.
4. Blur the input by tapping outside. Confirm the viewport is still at 1.0.
5. Repeat steps 3-4 for the `md` variant input.
6. Repeat steps 3-4 for a `sm` and `md` Textarea on the same page.
7. With Safari devtools attached over USB, inspect the focused input. Confirm computed `font-size` is ≥ 16px at the current viewport width (use Inspect Element → Computed → font-size).
8. Rotate to landscape. If landscape width is > 768px, confirm the `sm` and `md` variants render with their compact desktop font-size (12-14px) and that desktop appearance is preserved.
9. Switch to an iPad held in landscape (>768px width). Confirm `sm` is rendered at the compact desktop font-size, not the mobile 16px override.

### Pass/fail checklist

- [ ] `sm` Input on phone portrait: no focus zoom
- [ ] `md` Input on phone portrait: no focus zoom
- [ ] `sm` Textarea on phone portrait: no focus zoom
- [ ] `md` Textarea on phone portrait: no focus zoom
- [ ] Computed font-size ≥ 16px on phone portrait under devtools inspection
- [ ] Desktop/iPad landscape (>768px): `sm`/`md` retain compact 12-14px font-size
- [ ] Viewport zoom level remains 1.0 across all focus/blur transitions

---

## NEW-024 — `dialog.showModal()` fallback on iOS Safari < 15.4

### Acceptance criteria (verbatim from brief.md)

- [ ] `dialog-shell.tsx` feature-detects `"showModal" in HTMLDialogElement.prototype`
- [ ] If `showModal` unavailable, falls back to a `<div role="dialog" aria-modal="true">` with manual focus trap (via `useFocusTrap` from `@diffgazer/keys`) + scroll lock + escape handler + inert background
- [ ] No throw on iOS Safari < 15.4
- [ ] All existing dialog tests pass
- [ ] New test: when `HTMLDialogElement.prototype.showModal` is mocked-deleted, fallback renders correctly

### Manual test steps

The iOS 15.4 row in the matrix is the primary target — that device must NOT support `dialog.showModal` natively. The iOS 17 rows verify the native path still works.

1. Open the dialog demo page on the device under test.
2. Tap the trigger that opens a modal dialog. Confirm the dialog opens with no JavaScript error. (Attach Safari devtools over USB and watch the console.) PASS if no exception is thrown.
3. Confirm the dialog content is keyboard-focused on open (first focusable element receives focus).
4. Confirm the background page does NOT scroll while the dialog is open (test by attempting two-finger scroll on the background area).
5. Tap a focusable element inside the dialog, then attempt to navigate with the on-screen keyboard's Tab/Next button if present. Confirm focus stays inside the dialog (focus trap works).
6. Tap outside the dialog (on the backdrop). Confirm the dialog closes (or remains open if `modal` is set to non-dismissable — observe documented behavior).
7. Reopen the dialog. Press the Escape key via an attached Bluetooth keyboard if available. Confirm the dialog closes on Escape.
8. Reopen the dialog. Confirm any background interactive elements (links, buttons) outside the dialog are not focusable or tappable while the dialog is open.
9. Close the dialog. Confirm focus returns to the trigger element that opened it.
10. On iOS 17 rows (where `showModal` IS supported natively), confirm the same steps pass using the native `<dialog>` path.

### Pass/fail checklist

- [ ] No JavaScript exception in Safari console when opening dialog (especially on iOS 15.4)
- [ ] Dialog content receives initial focus on open
- [ ] Background page is scroll-locked while dialog is open
- [ ] Focus stays trapped inside dialog when navigating via keyboard
- [ ] Backdrop tap closes dialog (if dismissable)
- [ ] Escape key closes dialog (if Bluetooth keyboard available)
- [ ] Background interactive elements cannot receive focus or tap while dialog is open
- [ ] Focus returns to trigger on close
- [ ] Behavior identical between iOS 15.4 fallback path and iOS 17 native path

---

## Device matrix

Fill in each cell with `PASS`, `FAIL`, or `N/A`. If `FAIL`, add a numbered note in the Notes column and expand the failure under "Overall notes" below.

| Device / OS | Browser | NEW-022 | NEW-023 | NEW-024 | Notes |
| --- | --- | --- | --- | --- | --- |
| iPhone iOS 15.4 | Safari |  |  |  |  |
| iPhone iOS 17 | Safari |  |  |  |  |
| iPad iPadOS 17 | Safari |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

---

## Sign-off

- **Verified by:**
- **Date:**
- **Build SHA:**
- **Docs site URL used for testing:**

### Overall notes

