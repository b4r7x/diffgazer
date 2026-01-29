# Web → CLI Mirror Checklist

Status tracking for mirroring web pages to CLI views.

---

## Pages

| # | Web Page | CLI Target | Status | Notes |
|---|----------|------------|--------|-------|
| 1 | `home.tsx` | `main-menu-view.tsx` | ✅ DONE | Row layout, ContextSidebar + HomeMenu |
| 2 | `review.tsx` | `review-view.tsx` | ⬜ TODO | 3-phase flow (progress→summary→results) |
| 3 | `history.tsx` | `history-screen.tsx` | ⬜ TODO | Already similar, verify exact match |
| 4 | `settings-hub.tsx` | `settings-view.tsx` | ⬜ TODO | Hub menu pattern |
| 5 | `settings.tsx` | - | ⬜ TODO | 3-tab settings (general/providers/diagnostics) |
| 6 | `settings-theme.tsx` | `theme-step.tsx` | ⬜ TODO | Add live preview |
| 7 | `trust-permissions.tsx` | `trust-step.tsx` | ⬜ TODO | Verify match |
| 8 | `provider-selector.tsx` | `provider-step.tsx` | ⬜ TODO | 2-pane with search/filters |
| 9 | `settings-about.tsx` | `diagnostics-step.tsx` | ⬜ TODO | Grid layout + buttons |

---

## Priority Order

### High Priority (core UX)
- [ ] **review** - main feature, 3-phase flow
- [ ] **history** - verify/align 3-pane layout

### Medium Priority (settings)
- [ ] **settings-hub** - hub menu pattern
- [ ] **provider-selector** - complex 2-pane

### Low Priority (simple pages)
- [ ] **settings-theme** - add preview
- [ ] **trust-permissions** - verify
- [ ] **settings-about** - verify

---

## Completion Criteria per Page

For each page:
1. ✅ Layout matches web (flex direction, gaps, widths)
2. ✅ Same components used (or Ink equivalents)
3. ✅ Same keyboard shortcuts
4. ✅ Same state management pattern
5. ✅ Type-check passes
6. ✅ Visual comparison OK

---

## Command

Use `/mirror-web-to-cli <page>` to mirror a page.

---

## Progress

- **Total**: 9 pages
- **Done**: 1 (11%)
- **Remaining**: 8

Last updated: 2026-01-30
