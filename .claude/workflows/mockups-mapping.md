# Mockups Mapping – UI Mocks to Components

This document maps the 26 Tailwind CSS mockups to specific React components and screens.

**Location:** `/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/`

---

## Summary by Screen

| Screen | Mockups | Component | Status |
|--------|---------|-----------|--------|
| Review Screen | 1–2, 9–18 | `review-screen.tsx` + sub-components | Phase 3B |
| Home Menu | 4, 19–21 | `main-menu.tsx` | Phase 3A |
| History Page | 5, 22–23 | `history-page.tsx` + table | Phase 3C |
| Settings | 6–8, 24 | `settings-page.tsx` + tabs | Phase 3D |
| Trust Modal | 3, 25 | `trust-prompt-modal.tsx` | Phase 4 |
| Setup Wizard | 26 | `setup-wizard-modal.tsx` | Phase 4 |
| Agent Inspector | 7, 11, 15 | `agent-inspector-modal.tsx` | Phase 4 |

---

## Detailed Mockup List

### Mockup #1: **Review Screen (Desktop Observatory)**
- **Title:** "Stargazer Observatory Review Screen"
- **Component:** `apps/web/src/features/review/components/review-screen.tsx`
- **Layout:** Split-pane (left: issue list, right: details)
- **Key Elements:**
  - Header: Logo, nav tabs (REVIEW highlighted), user profile
  - Left pane: Issue list with severity badges, lens icons
  - Right pane: Issue details, code diff, action buttons
  - Footer: Connection status, user info
- **Phase:** 3B
- **Notes:** Primary design reference for web layout. Dark theme.

---

### Mockup #2: **Review Screen (TUI Variant)**
- **Title:** "Stargazer TUI Review Workflow"
- **Component:** Same as #1 but monospace-first styling
- **Layout:** Same split-pane
- **Key Elements:** Similar to #1, but uses mono font exclusively
- **Phase:** 3B
- **Notes:** Reference for accessible/terminal-friendly version. Don't duplicate code.

---

### Mockup #3: **Trust Prompt Modal**
- **Title:** "Stargazer TUI Trust Prompt"
- **Component:** `apps/web/src/features/modals/components/trust-prompt-modal.tsx`
- **Layout:** Centered modal dialog
- **Key Elements:**
  - Title: "Trust this repository?"
  - Body: Explanation + repo name
  - Buttons: [Cancel] [Trust Session] [Trust Permanently]
- **Phase:** 4
- **Notes:** Appears on first review of a repo. Keyboard accessible (Tab, Enter, Escape).

---

### Mockup #4: **Home Menu**
- **Title:** "Stargazer TUI Home Menu"
- **Component:** `apps/web/src/features/menu/components/main-menu.tsx`
- **Layout:** Centered menu
- **Key Elements:**
  - Logo + tagline ("AI-Powered Code Review")
  - Quick action buttons:
    - Review Unstaged
    - Review Staged
    - View History
    - Sessions
    - Settings
- **Phase:** 3A
- **Notes:** Entry point from `/` route. Simple button navigation.

---

### Mockup #5: **History Page**
- **Title:** "Stargazer TUI History List"
- **Component:** `apps/web/src/features/history/components/history-page.tsx`
- **Layout:** Full-width table
- **Key Elements:**
  - Header: Logo, nav tabs (HISTORY highlighted)
  - Table columns: Review ID, Scope, Date, Issue Count, Status
  - Filter bar: Scope, severity, date range
  - Rows are clickable → navigate to `/review/$reviewId`
- **Phase:** 3C
- **Notes:** Sortable columns, pagination if >50 reviews.

---

### Mockup #6: **Settings – Provider Tab**
- **Title:** "Stargazer TUI Settings – AI Provider"
- **Component:** `apps/web/src/features/settings/components/provider-config.tsx` (in `settings-page.tsx`)
- **Layout:** Form in tab panel
- **Key Elements:**
  - Dropdown: Select AI provider (OpenRouter, Zhipu, etc.)
  - Input: API key (masked input)
  - Input: Model ID
  - Input: Endpoint URL (optional)
  - Button: "Test Connection" + spinner
  - Status: "✓ Connected" or "✗ Connection Failed"
- **Phase:** 3D
- **Notes:** Integrates with @repo/schemas SettingsConfig type.

---

### Mockup #7: **Settings – Diagnostics Tab**
- **Title:** "Stargazer TUI Settings – Diagnostics"
- **Component:** `apps/web/src/features/settings/components/diagnostics-tab.tsx` (in `settings-page.tsx`)
- **Layout:** Two-column: status on left, logs on right
- **Key Elements:**
  - Left: Server health indicator, version info, last sync time
  - Right: Error log (scrollable list)
  - Button: "Clear Logs"
- **Phase:** 3D
- **Notes:** Real-time status updates from API `/health`.

---

### Mockup #8: **Settings – Permissions Tab**
- **Title:** "Stargazer TUI Settings – Permissions"
- **Component:** `apps/web/src/features/settings/components/permissions-tab.tsx` (in `settings-page.tsx`)
- **Layout:** Matrix + toggles
- **Key Elements:**
  - Table: Repository x Capabilities (read, write, execute)
  - Column: Trust Mode (session / persistent)
  - Buttons: [Add Repo] [Remove]
- **Phase:** 3D
- **Notes:** Manage trust configuration per repository.

---

### Mockup #9: **Review Screen – Issue Item Hover**
- **Title:** (Variant of #1)
- **Component:** `apps/web/src/features/review/components/issue-item.tsx`
- **Key Elements:** Issue row with hover highlighting
- **Phase:** 3B
- **Notes:** Reference for CSS hover states on list items.

---

### Mockup #10: **Review Screen – Filter Bar Active**
- **Title:** (Variant of #1)
- **Component:** `apps/web/src/features/review/components/filter-toolbar.tsx`
- **Key Elements:** Filter dropdowns showing active selections
- **Phase:** 3B
- **Notes:** Show how filters appear when open.

---

### Mockup #11: **Agent Inspector Modal – Reasoning Tab**
- **Title:** (Variant showing drill-down details)
- **Component:** `apps/web/src/features/modals/components/agent-inspector-modal.tsx`
- **Layout:** Modal with tabs
- **Key Elements:**
  - Tabs: [Reasoning] [Suggestions] [Related Issues]
  - Content: Full conversation transcript with AI
  - Buttons: [Close] [Apply Suggestion]
- **Phase:** 4
- **Notes:** Triggered by "Drill Down" button in review screen.

---

### Mockup #12–#18: **Review Screen – Variations**
- **Title:** (Various states of review workflow)
- **Components:** Multiple sub-components of review-screen
- **Key Elements:**
  - Severity badge variations (high, medium, low)
  - Different issue types
  - Code diff variations
  - Action panel states (enabled/disabled)
- **Phase:** 3B
- **Notes:** Reference for all possible states of review screen UI.

---

### Mockup #19: **Home Menu – Loading State**
- **Title:** (Variant showing loading spinner)
- **Component:** `apps/web/src/features/menu/components/main-menu.tsx`
- **Key Elements:** Button with loading spinner, disabled state
- **Phase:** 3A
- **Notes:** Reference for button loading state component.

---

### Mockup #20: **Home Menu – Error State**
- **Title:** (Variant showing error message)
- **Component:** `apps/web/src/features/menu/components/main-menu.tsx` or `__root.tsx`
- **Key Elements:** Error message banner, retry button
- **Phase:** 3A
- **Notes:** If API fails to load on menu screen.

---

### Mockup #21: **Home Menu – Accessibility Focus**
- **Title:** (Variant with focus states)
- **Component:** `apps/web/src/features/menu/components/main-menu.tsx`
- **Key Elements:** Keyboard focus ring on buttons
- **Phase:** 3A
- **Notes:** Reference for focus states (outline, highlight).

---

### Mockup #22: **History Page – Empty State**
- **Title:** (Variant showing no reviews)
- **Component:** `apps/web/src/components/common/empty-state.tsx` used in history-page
- **Key Elements:** Icon, message "No reviews yet", action button
- **Phase:** 3C
- **Notes:** Show when no reviews in history.

---

### Mockup #23: **History Page – Sorting Active**
- **Title:** (Variant showing sort indicator)
- **Component:** `apps/web/src/features/history/components/history-table.tsx`
- **Key Elements:** Column header with sort arrow, sorted column highlighted
- **Phase:** 3C
- **Notes:** Reference for sorting UI.

---

### Mockup #24: **Settings – Tabs Navigation**
- **Title:** (Variant showing tab switching)
- **Component:** `apps/web/src/components/navigation/tab-nav.tsx` in settings-page
- **Key Elements:** Tab buttons (Provider, Permissions, Diagnostics), active tab highlighted
- **Phase:** 3D
- **Notes:** Reference for tab nav styling and transitions.

---

### Mockup #25: **Trust Modal – With Confirmation**
- **Title:** (Variant showing button interaction)
- **Component:** `apps/web/src/features/modals/components/trust-prompt-modal.tsx`
- **Key Elements:** Buttons in different states (hover, active, disabled)
- **Phase:** 4
- **Notes:** Reference for modal button interaction states.

---

### Mockup #26: **Setup Wizard Modal – Step 1**
- **Title:** (First step of onboarding)
- **Component:** `apps/web/src/features/modals/components/setup-wizard-modal.tsx`
- **Layout:** Multi-step form in modal
- **Key Elements:**
  - Step indicator: "Step 1 of 4"
  - Dropdown: "Select AI Provider"
  - Buttons: [Back] [Next]
- **Phase:** 4
- **Notes:** Shows first step. Likely has steps 2–4 in same mockup folder or implied.

---

## Component-to-Mockup Reverse Map

### UI Primitives (Phase 1)
- **Button:** All mockups (see mockups #19, #21 for variant reference)
- **Badge:** Mockups #1, #2, #5, #12–#18
- **Input:** Mockups #6, #8, #26
- **Card:** Mockups #1, #5
- **Tabs:** Mockups #7, #8, #11, #24
- **Modal:** Mockups #3, #11, #25, #26
- **Popover/Dropdown:** Mockups #6, #10, #23

### Layout Components (Phase 2)
- **Header:** All mockups (top bar with logo + nav tabs)
- **Footer:** Mockups #1, #2, #5 (bottom status bar)
- **SplitPane:** Mockups #1, #2, #9–#18 (main layout)
- **Sidebar:** Mockups #1, #2 (left panel with issue list)
- **ContentPanel:** Mockups #1, #2 (right panel with details)
- **MainLayout:** Wraps all page-level components

### Feature Screens (Phase 3)
- **main-menu.tsx:** Mockups #4, #19, #20, #21
- **review-screen.tsx:** Mockups #1, #2, #9–#18
- **issue-list.tsx:** Mockups #1, #2, #9–#10
- **issue-details.tsx:** Mockups #1, #2, #12–#18
- **code-diff.tsx:** Mockups #1, #2 (right pane content)
- **filter-toolbar.tsx:** Mockups #10, #1
- **actions-panel.tsx:** Mockups #1, #2 (right pane buttons)
- **history-page.tsx:** Mockups #5, #22–#23
- **history-table.tsx:** Mockups #5, #23
- **settings-page.tsx:** Mockups #6–#8, #24

### Modals (Phase 4)
- **trust-prompt-modal.tsx:** Mockups #3, #25
- **setup-wizard-modal.tsx:** Mockup #26
- **agent-inspector-modal.tsx:** Mockup #11 (+ referenced in #1, #2)
- **confirm-modal.tsx:** Generic (not explicitly shown, but needed for delete/apply confirm)

---

## Using Mockups as Reference

### Strategy
1. **Phase 1 primitives:** Use mockups to identify color palette, typography, shadows
2. **Phase 2 layout:** Use mockups #1, #2, #5 to establish header/footer/split-pane layout
3. **Phase 3 screens:**
   - **Home Menu:** Use #4 as primary reference
   - **Review:** Use #1 (desktop) + #2 (terminal) for accessibility
   - **History:** Use #5 for table layout
   - **Settings:** Use #6–#8 for tab structure and form layout
4. **Phase 4 modals:** Use #3, #11, #26 for modal patterns

### Don't Copy HTML Directly
- Mockups are static HTML with inline styles
- Extract **layout structure** (split-pane, tabs, table columns)
- Extract **visual intent** (colors, spacing, typography)
- Rebuild using React + Tailwind components

### Key Visual Patterns from Mockups
- **Dark theme:** Background #0A0E14, surface #161B22
- **Primary color:** #79C0FF (Starlight blue) for active states, links, highlights
- **Secondary color:** #BC8CFF (Aurora violet) for accents
- **Borders:** #30363d (subtle, not black)
- **Fonts:**
  - Display/headings: Space Grotesk (bold, 600–700 weight)
  - Body: Inter (400–500 weight)
  - Code/mono: JetBrains Mono (400–500 weight)
- **Spacing:** Consistent 8px and 16px padding/margins
- **Shadows:** Glow effect on primary interactive elements

---

## Testing Against Mockups

After implementing each component:

1. **Visual Regression:** Compare rendered component against mockup screenshot
2. **Layout Alignment:** Check spacing, alignment, pane proportions match mockup
3. **Interaction:** Test hover states, focus states, disabled states
4. **Responsive:** Verify component adapts to mobile/tablet breakpoints (if shown in mockup)

**Tools:**
- Chrome DevTools: Toggle device emulation to compare with mockup
- Storybook (future): Create component stories with mockup backgrounds

---

## File Structure for Reference

All mockups available at:
```
/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/

stargazer_issue_review_dashboard_1/
├── code.html          ← Full HTML mockup
├── screenshot.png     ← Visual preview (if available)
└── metadata.json      ← Mockup metadata (if available)
```

To view mockups:
```bash
open "/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_1/code.html"
```

---

## Summary Checklist

Use this to track implementation against mockups:

### Phase 1: Primitives
- [ ] Button (all color/size variants from mockups)
- [ ] Badge (severity colors: red, yellow, green from mockups)
- [ ] Input (match input styling in #6, #26)
- [ ] Card (match card backgrounds in #1, #5)
- [ ] Other primitives (tabs, modal, popover, tooltip)

### Phase 2: Layout
- [ ] Header (match #1, #2, #5 header styling)
- [ ] Footer (match #1, #2, #5 footer)
- [ ] SplitPane (match left/right pane proportions in #1, #2)
- [ ] Other layout (sidebar, content panel)

### Phase 3A: Home Menu
- [ ] Logo + tagline match #4
- [ ] Button layout matches #4
- [ ] Loading state (reference #19)
- [ ] Error state (reference #20)

### Phase 3B: Review Screen
- [ ] Layout matches #1 or #2 (choose one as primary)
- [ ] Issue list matches #1, #2, #9–#10
- [ ] Issue details match #1, #2, #12–#18
- [ ] Code diff matches #1, #2
- [ ] Filter toolbar matches #10
- [ ] Action panel matches #1, #2

### Phase 3C: History
- [ ] Table layout matches #5
- [ ] Empty state matches #22
- [ ] Sorting UI matches #23

### Phase 3D: Settings
- [ ] Tab nav matches #24
- [ ] Provider config matches #6
- [ ] Diagnostics matches #7
- [ ] Permissions matches #8

### Phase 4: Modals
- [ ] Trust modal matches #3, #25
- [ ] Setup wizard matches #26
- [ ] Agent inspector matches #11
- [ ] Confirm modal (create generic pattern)

---

## Questions?

- **Layout question:** Check mockups #1, #2 for split-pane structure
- **Color question:** Check mockups for color hex codes (search HTML source)
- **Typography question:** Check mockups for font family declarations
- **Spacing question:** Use Firefox/Chrome DevTools to inspect element spacing in mockup HTML
