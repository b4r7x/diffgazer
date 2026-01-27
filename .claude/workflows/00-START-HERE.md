# Web Implementation Workflow – START HERE

**Created:** 2026-01-27
**For:** React 19 web app build from 26 Tailwind CSS mockups
**Timeline:** 10–15 days (phases 1–5)

---

## What Was Created

Four comprehensive workflow documents to guide building the Stargazer web UI:

### 1. **WEB-IMPLEMENTATION-README.md**
Overview document. Read this first to understand the complete workflow and file structure.
- Quick start guide
- Document reading order
- Phase summary table
- Command reference

### 2. **web-implementation-phases.md** ⭐ MAIN DOCUMENT
Detailed 5-phase implementation plan with:
- Goals for each phase
- Files to create (with full paths)
- Component dependencies
- Testing approach (unit, integration, E2E)
- Acceptance criteria
- Time estimates
- Full file structure diagram

**Critical Path:** Phase 1 → Phase 2 → Phase 3B (Review Screen)

### 3. **web-implementation-quick-ref.md**
Developer reference guide. Keep open during coding for:
- Phase quick-start checklists
- Component code templates
- Design token cheat sheet
- Common patterns (forms, fetch, keyboard nav)
- Testing template
- Debugging tips
- File paths

### 4. **mockups-mapping.md**
Visual reference mapping all 26 mockups to components:
- Description of each mockup
- Component file it maps to
- Key visual elements
- Phase and notes
- Reverse component-to-mockup lookup table
- Visual patterns (colors, typography, spacing)

---

## How to Use This Workflow

### Start (Day 1)
```bash
# 1. Read the overview
open .claude/workflows/WEB-IMPLEMENTATION-README.md

# 2. Understand the full plan
open .claude/workflows/web-implementation-phases.md
# Focus on: Overview, Phase 1 Goals, Phase 1 Files to Create

# 3. View some mockups
open "/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_1/code.html"
open "/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_4/code.html"

# 4. Start developing
cd /Users/voitz/Projects/stargazer/apps/web
npm run dev
```

### Phase 1 (Building Primitives)
```bash
# Follow Phase 1 checklist from web-implementation-phases.md
# Quick reference: web-implementation-quick-ref.md

# Create components in order:
# 1. Button
# 2. Input
# 3. Badge
# 4. Card
# 5. Tabs
# 6. Popover
# 7. Tooltip
# 8. Modal

# Test as you go:
npx vitest run src/components/ui/

# When phase 1 complete:
git add apps/web/src/components/ui
git commit -m "Phase 1: Add UI primitives"
```

### Phase 2 (Layout Components)
```bash
# Follow Phase 2 from web-implementation-phases.md
# Reference mockups #1, #2, #5 (show header/footer/split-pane)

# Create components:
# 1. Header
# 2. Footer
# 3. SplitPane
# 4. Sidebar
# 5. ContentPanel
# 6. MainLayout wrapper

git commit -m "Phase 2: Add layout components"
```

### Phases 3–5
```bash
# Follow same pattern
# Reference web-implementation-phases.md for each phase
# Use mockups-mapping.md to find relevant mockups
# Use web-implementation-quick-ref.md for code patterns

# Key checkpoints:
# - Phase 3B (Review Screen) is critical path
# - Phase 5 includes accessibility audit and Lighthouse testing
```

---

## File Locations

### Workflow Documents (Reference)
```
.claude/workflows/
├── 00-START-HERE.md                    ← You are here
├── WEB-IMPLEMENTATION-README.md         ← Read first
├── web-implementation-phases.md         ← Main plan (26 KB)
├── web-implementation-quick-ref.md      ← Dev reference (14 KB)
└── mockups-mapping.md                   ← Visual guide (14 KB)
```

### Mockups (Reference)
```
/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/
├── stargazer_issue_review_dashboard_1/     (Review Screen – Desktop)
├── stargazer_issue_review_dashboard_2/     (Review Screen – TUI)
├── stargazer_issue_review_dashboard_3/     (Trust Modal)
├── stargazer_issue_review_dashboard_4/     (Home Menu)
├── stargazer_issue_review_dashboard_5/     (History Page)
├── stargazer_issue_review_dashboard_6/     (Settings – Provider Tab)
├── stargazer_issue_review_dashboard_7/     (Settings – Diagnostics Tab)
├── stargazer_issue_review_dashboard_8/     (Settings – Permissions Tab)
├── stargazer_issue_review_dashboard_9-18/  (Review variations)
├── stargazer_issue_review_dashboard_19-21/ (Home Menu variants)
├── stargazer_issue_review_dashboard_22-23/ (History variants)
├── stargazer_issue_review_dashboard_24/    (Settings tabs nav)
├── stargazer_issue_review_dashboard_25/    (Trust modal variant)
└── stargazer_issue_review_dashboard_26/    (Setup Wizard)
```

### Web App Source (Implementation)
```
/Users/voitz/Projects/stargazer/apps/web/src/

After Phase 1:
apps/web/src/components/ui/           (Button, Input, Badge, etc.)

After Phase 2:
apps/web/src/components/layout/       (Header, Footer, SplitPane, etc.)

After Phase 3:
apps/web/src/features/menu/           (MainMenu component)
apps/web/src/features/review/         (ReviewScreen, IssueList, etc.)
apps/web/src/features/history/        (HistoryPage, table)
apps/web/src/features/settings/       (SettingsPage, provider/permissions/diagnostics tabs)

After Phase 4:
apps/web/src/features/modals/         (TrustPrompt, SetupWizard, AgentInspector, etc.)
```

---

## Quick Command Reference

```bash
# Development
cd /Users/voitz/Projects/stargazer
npm run dev                    # Start Vite dev server (port 5173)

# Testing
npx vitest run                 # Run all tests
npx vitest run --ui            # Interactive test dashboard
npx vitest run --coverage      # Coverage report

# Building
npm run build                  # Build all packages
npm run type-check             # TypeScript validation

# Git
git checkout -b feature/web-phase-1    # Create feature branch
git add apps/web/src/components/ui     # Stage files
git commit -m "Phase 1: ..."            # Commit
git push origin feature/web-phase-1    # Push to remote
```

---

## Document Navigation

**I want to...**

| Goal | Read |
|------|------|
| Understand the full plan | WEB-IMPLEMENTATION-README.md |
| Get detailed specs for Phase N | web-implementation-phases.md (Phase N section) |
| Code a component now | web-implementation-quick-ref.md |
| Find which mockup is for my component | mockups-mapping.md |
| View the visual design | Open mockup HTML file (see paths above) |
| Know what to test | web-implementation-phases.md (Phase N → Testing Approach) |
| Debug a TypeScript error | web-implementation-quick-ref.md → Debugging Tips |
| Know the design tokens | web-implementation-quick-ref.md → Design Tokens Cheat Sheet |

---

## Phase Summary (10–15 Days Total)

| Phase | Goal | Days | Status |
|-------|------|------|--------|
| 1 | UI Primitives | 2–3 | TODO |
| 2 | Layout Components | 2–3 | TODO |
| 3A | Home Menu | <1 | TODO |
| 3B | Review Screen (CRITICAL) | 4–5 | TODO |
| 3C | History Page | 2–3 | TODO |
| 3D | Settings Page | 2–3 | TODO |
| 4 | Modals & Polish | 1–2 | TODO |
| 5 | Accessibility & Performance | 1–2 | TODO |

---

## Success Criteria

After completing all phases:

- [ ] All 8 UI primitives created with ≥2 variants
- [ ] Header, footer, split-pane working
- [ ] Home menu navigates to correct routes
- [ ] Review screen loads, filters, sorts, applies patches ⭐ CRITICAL
- [ ] History page shows past reviews
- [ ] Settings saves API config
- [ ] Modals open/close and validate
- [ ] Lighthouse ≥90 (performance, accessibility, etc.)
- [ ] Keyboard navigation works on all screens
- [ ] Color contrast ≥4.5:1

---

## Key Notes

1. **Mockups are reference, not to copy:** Extract layout structure and visual intent, rebuild with React components

2. **Design tokens from mockups:** Colors (#79C0FF blue, #BC8CFF violet), fonts (Space Grotesk, Inter, JetBrains Mono), spacing (8px base)

3. **Critical path:** Phase 1 → Phase 2 → Phase 3B. Do these in order.

4. **Architecture:** Use @repo/api for data fetch, @repo/schemas for types, @repo/core for utilities. No Redux. React hooks for state.

5. **Testing:** Unit tests for primitives, integration tests for features, E2E for full flows. See web-implementation-phases.md for strategy.

---

## Getting Unstuck

**Q: Where is mockup #N?**
```bash
open "/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_N/code.html"
```

**Q: What component do I build for mockup #N?**
```bash
grep "Mockup #N" .claude/workflows/mockups-mapping.md
```

**Q: How do I test this?**
```bash
# See Phase 1–5 "Testing Approach" in web-implementation-phases.md
# Or see "Testing Template" in web-implementation-quick-ref.md
```

**Q: What design tokens should I use?**
```bash
# See "Design Tokens Cheat Sheet" in web-implementation-quick-ref.md
# Or extract from mockup HTML (see mockups-mapping.md)
```

---

## Next Steps

1. **Now:** Read WEB-IMPLEMENTATION-README.md
2. **Today:** Start Phase 1 (Button, Input, Badge primitives)
3. **Check:** Verify Phase 1 acceptance criteria met
4. **Commit:** After Phase 1 complete
5. **Continue:** Phase 2 → Phase 3 → etc.

---

## Document Stats

| File | Size | Purpose |
|------|------|---------|
| WEB-IMPLEMENTATION-README.md | 12 KB | Overview & guide |
| web-implementation-phases.md | 26 KB | Detailed 5-phase plan |
| web-implementation-quick-ref.md | 14 KB | Developer quick reference |
| mockups-mapping.md | 14 KB | Mockup to component mapping |
| **Total** | **~66 KB** | Complete workflow package |

All files in: `.claude/workflows/`

---

## Created By

Claude Code (Haiku 4.5)
Generated: 2026-01-27
For: Stargazer Web UI Implementation

---

## Quick Links

- [WEB-IMPLEMENTATION-README.md](.claude/workflows/WEB-IMPLEMENTATION-README.md)
- [web-implementation-phases.md](.claude/workflows/web-implementation-phases.md)
- [web-implementation-quick-ref.md](.claude/workflows/web-implementation-quick-ref.md)
- [mockups-mapping.md](.claude/workflows/mockups-mapping.md)

**Ready to start?** → Open WEB-IMPLEMENTATION-README.md
