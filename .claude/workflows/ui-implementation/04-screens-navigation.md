# Workflow 04: Screens & Navigation

## Overview

Update all screens to use new components and implement proper navigation flow.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review using React 19 + Ink.

### Screen Structure
```
apps/cli/src/app/
├── app.tsx           # Main app with routing
├── screens/          # Full-page screens
│   ├── onboarding-screen.tsx
│   ├── settings-screen.tsx
│   ├── sessions-screen.tsx
│   └── review-history-screen.tsx
└── views/            # View components for main screen
    ├── main-menu-view.tsx
    ├── review-view.tsx
    └── ...
```

### Navigation Flow
```
TRUST_WIZARD → SETUP_WIZARD → HOME_MENU
                                  ↓
                    ┌─────────────┼─────────────┐
                    ↓             ↓             ↓
                 REVIEW       HISTORY       SETTINGS
```

### State Management
- App state in `use-app-state.ts`
- Screen-specific state in screen components
- Navigation via `use-navigation.ts`

---

## Task 1: Update Onboarding Screen

**Agent:** `react-component-architect`

**File:** `apps/cli/src/app/screens/onboarding-screen.tsx`

### Changes:

1. **Add Trust Step (Step 0)**
   - Check trust status on mount
   - Show TrustStep if not trusted
   - Store trust config on completion

2. **Use Wizard Components**
   - Replace inline components with wizard step components
   - Use WizardFrame for consistent layout

3. **Update Step Flow**
   ```typescript
   const STEPS = [
     { id: "trust", component: TrustStep },
     { id: "theme", component: ThemeStep },
     { id: "provider", component: ProviderStep },
     { id: "credentials", component: CredentialsStep },
     { id: "controls", component: ControlsStep },
     { id: "summary", component: SummaryStep },
   ];
   ```

4. **Add Hook:** `apps/cli/src/hooks/use-trust.ts`
   ```typescript
   export function useTrust() {
     const loadTrustStatus = async (projectId: string) => {...};
     const saveTrust = async (config: TrustConfig) => {...};
     const checkCurrentDirectory = async () => {...};
     return { loadTrustStatus, saveTrust, checkCurrentDirectory };
   }
   ```

### Implementation Notes:
- Skip trust step if already trusted (check on mount)
- Store theme in settings before moving to provider
- Save all settings at summary step
- Transition to HOME_MENU on finish

---

## Task 2: Update Settings Screen

**Agent:** `react-component-architect`

**File:** `apps/cli/src/app/screens/settings-screen.tsx`

### Changes:

1. **Show Section List**
   ```typescript
   const SECTIONS = [
     { id: "trust", label: "Trust & Permissions", icon: "🔒" },
     { id: "theme", label: "Theme", icon: "🎨" },
     { id: "provider", label: "Provider & Model", icon: "🤖" },
     { id: "credentials", label: "Credentials", icon: "🔑" },
     { id: "controls", label: "Controls", icon: "⌨️" },
     { id: "diagnostics", label: "About / Diagnostics", icon: "ℹ️" },
   ];
   ```

2. **Section Navigation**
   - SelectList for section selection
   - Enter to open section
   - Section renders wizard step in `mode="settings"`

3. **Add Diagnostics Section**
   - Show version, config paths
   - "Test connection" button
   - Reset to defaults option

4. **Add Hook:** `apps/cli/src/hooks/use-settings.ts`
   ```typescript
   export function useSettings() {
     const loadSettings = async () => {...};
     const saveSettings = async (settings: SettingsConfig) => {...};
     const loadProviderStatus = async () => {...};
     return { loadSettings, saveSettings, loadProviderStatus };
   }
   ```

### Implementation Notes:
- Load current settings on mount
- Save changes immediately or on explicit save
- Show unsaved changes indicator
- Credentials section: Replace key / Remove key options

---

## Task 3: Integrate Review Split Screen

**Agent:** `react-component-architect`

**File:** `apps/cli/src/app/views/review-view.tsx`

### Changes:

1. **Replace Simple Display**
   - Use ReviewSplitScreen instead of ReviewDisplay
   - Full split-pane layout with issue list + details

2. **Add State Management**
   ```typescript
   interface ReviewViewState {
     selectedIssueId: string | null;
     viewTab: "details" | "explain" | "trace" | "patch";
     focus: "list" | "details";
     filters: FilterState;
     scrollOffsets: { list: number; details: number };
   }
   ```

3. **Add Keyboard Hook:** `apps/cli/src/features/review/hooks/use-review-keyboard.ts`
   ```typescript
   export function useReviewKeyboard(
     state: ReviewViewState,
     dispatch: (action: Action) => void,
     issues: Issue[]
   ) {
     useInput((input, key) => {
       if (state.focus === "list") {
         // j/k or arrows: move selection
         // n/p: next/prev open issue
         // Enter/o: open issue
         // e: show explain tab
         // t: show trace tab
         // a: apply patch
         // i: ignore
         // /: search mode
         // Tab: focus details
         // Esc: back to menu
       } else {
         // j/k or arrows: scroll content
         // Tab: cycle tabs
         // a: confirm apply (on patch tab)
         // Esc: focus list
       }
     });
   }
   ```

4. **Connect to Existing Hooks**
   - Use `useTriage` for review data
   - Use `useTriageHistory` for persistence

### Implementation Notes:
- Initialize with first issue selected
- Auto-trigger drilldown when opening issue (if needed)
- Update issue state on apply/ignore
- Persist state to session events

---

## Task 4: Create Unified History Screen

**Agent:** `react-component-architect`

**File:** `apps/cli/src/app/screens/history-screen.tsx` (new)

### Implementation:

1. **Tab Structure**
   ```typescript
   type HistoryTab = "reviews" | "sessions";

   interface HistoryScreenState {
     activeTab: HistoryTab;
     selectedIndex: number;
     detailView: "list" | "details";
     selectedItemId: string | null;
   }
   ```

2. **Reviews Tab**
   - List of ReviewRun items
   - Shows: date, scope, issue count, severity summary
   - Actions: Resume, Export, Delete

3. **Sessions Tab**
   - List of Session items
   - Shows: date, event count, duration
   - Actions: View timeline, Delete

4. **Detail Views**
   - ReviewRunDetails: summary, stats, issue list, export
   - SessionDetails: event timeline

5. **Add Hook:** `apps/cli/src/hooks/use-session-events.ts`
   ```typescript
   export function useSessionEvents(sessionId: string) {
     const { data, loading, error } = useAsyncOperation(
       () => loadSessionEvents(sessionId)
     );
     return { events: data, loading, error };
   }
   ```

### Keyboard Shortcuts:
- Tab: switch Reviews/Sessions
- j/k: navigate list
- Enter: open details
- r: resume review (on Reviews tab)
- e: export
- d: delete (with confirmation)
- Esc: back

---

## Task 5: Update App Navigation

**Agent:** `react-component-architect`

**File:** `apps/cli/src/features/app/hooks/use-navigation.ts`

### Changes:

1. **Add Screen Enum**
   ```typescript
   export type Screen =
     | "loading"
     | "trust-wizard"
     | "setup-wizard"
     | "main"
     | "review"
     | "history"
     | "settings"
     | "help";
   ```

2. **Update Navigation Logic**
   ```typescript
   function determineInitialScreen(
     trust: TrustConfig | null,
     config: UserConfig | null
   ): Screen {
     if (!trust) return "trust-wizard";
     if (!config) return "setup-wizard";
     return "main";
   }
   ```

3. **Add Navigation Helpers**
   ```typescript
   const navigate = (screen: Screen) => {...};
   const goBack = () => {...};
   const canGoBack = () => {...};
   ```

---

## Task 6: Update Main Menu

**Agent:** `react-component-architect`

**File:** `apps/cli/src/app/views/main-menu-view.tsx`

### Changes:

1. **Update Menu Items**
   ```typescript
   const MENU_ITEMS = [
     { key: "r", label: "Review unstaged changes", screen: "review" },
     { key: "R", label: "Review staged changes", screen: "review" },
     { key: "f", label: "Review specific files...", screen: "review" },
     { key: "l", label: "Resume last review", screen: "review" },
     { key: "h", label: "History", screen: "history" },
     { key: "s", label: "Settings", screen: "settings" },
     { key: "?", label: "Help", screen: "help" },
     { key: "q", label: "Quit", action: "quit" },
   ];
   ```

2. **Add Status Card**
   - Show current provider/model
   - Show trust status
   - Show last review timestamp

---

## Validation

After completing all tasks:

```bash
npm run type-check
```

Test navigation flow:
1. Fresh start → Trust → Setup → Home
2. Home → Settings → Edit each section
3. Home → Review → Navigate issues
4. Home → History → View/Resume reviews
