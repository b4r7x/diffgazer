# Phase 2: Key Mode Navigation

## Overview

Implement vim-style keyboard navigation as an alternative to menu mode.

**Priority:** CRITICAL
**Dependencies:** None (can run parallel with Phase 1)

---

## Context

### What is Key Mode?

Two navigation modes:
- **Menu Mode** (default): Arrow keys + Enter, visual selection
- **Key Mode** (vim-style): Single-key actions, power-user friendly

Key mode shortcuts:
```
j/k     - Move up/down in list
o       - Open (enter detail/drilldown)
a       - Apply patch
i       - Ignore issue
e       - Show Explain tab
t       - Show Trace tab
n/p     - Next/Previous open issue
Tab     - Switch focus (list <-> details)
Esc/q   - Back / Quit
```

### Why Both Modes?

- Menu mode: Discoverable, beginner-friendly
- Key mode: Fast, efficient for power users
- User chooses in settings (controlsMode: "menu" | "keys")

---

## Existing Code References

Read these files first:
- `packages/schemas/src/settings.ts` - ControlsMode type
- `apps/cli/src/hooks/use-settings.ts` - Settings hook
- `apps/cli/src/features/review/components/review-screen.tsx` - Current review UI
- Ink documentation: `useInput` hook

---

## Agent 2.1: Keyboard Mode Hook

```
subagent_type: "react-component-architect"

Task: Create global keyboard mode management hook.

Create: apps/cli/src/hooks/use-keyboard-mode.ts

IMPORTANT:
- Read mode from settings (controlsMode)
- Provide context for nested components
- Helper functions for mode checks

Implementation:

import { createContext, useContext, useMemo } from 'react';
import { useSettings } from './use-settings';
import type { ControlsMode } from '@repo/schemas';

interface KeyboardModeContextValue {
  mode: ControlsMode;
  isKeyMode: boolean;
  isMenuMode: boolean;
}

export const KeyboardModeContext = createContext<KeyboardModeContextValue>({
  mode: 'menu',
  isKeyMode: false,
  isMenuMode: true,
});

export function useKeyboardModeProvider() {
  const { settings } = useSettings();
  const mode = settings?.controlsMode ?? 'menu';

  const value = useMemo<KeyboardModeContextValue>(() => ({
    mode,
    isKeyMode: mode === 'keys',
    isMenuMode: mode === 'menu',
  }), [mode]);

  return value;
}

export function useKeyboardMode() {
  return useContext(KeyboardModeContext);
}

// Helper hook for conditional key handling
export function useKeyModeInput(
  keyHandler: (key: string) => void,
  deps: unknown[] = []
) {
  const { isKeyMode } = useKeyboardMode();
  const { useInput } = require('ink');

  useInput((input: string, key: any) => {
    if (!isKeyMode) return;

    // Normalize key
    const normalizedKey = key.return ? 'enter' :
                          key.escape ? 'esc' :
                          key.tab ? 'tab' :
                          key.upArrow ? 'up' :
                          key.downArrow ? 'down' :
                          input.toLowerCase();

    keyHandler(normalizedKey);
  }, { isActive: isKeyMode });
}

Create: apps/cli/src/hooks/keyboard-mode-provider.tsx

import { ReactNode } from 'react';
import { KeyboardModeContext, useKeyboardModeProvider } from './use-keyboard-mode';

interface KeyboardModeProviderProps {
  children: ReactNode;
}

export function KeyboardModeProvider({ children }: KeyboardModeProviderProps) {
  const value = useKeyboardModeProvider();
  return (
    <KeyboardModeContext.Provider value={value}>
      {children}
    </KeyboardModeContext.Provider>
  );
}

Update: apps/cli/src/hooks/index.ts
- Export useKeyboardMode, useKeyModeInput
- Export KeyboardModeProvider

Steps:
1. Create use-keyboard-mode.ts
2. Create provider component
3. Export from index.ts
4. Run: npm run type-check

Output: Keyboard mode hook and provider
```

---

## Agent 2.2: Review Keyboard Handler

```
subagent_type: "react-component-architect"

Task: Create keyboard handler specifically for review screen.

Create: apps/cli/src/features/review/hooks/use-review-keyboard.ts

IMPORTANT:
- Handle both menu and key modes
- Focus-aware key routing (list vs details)
- All callbacks are optional

Implementation:

import { useInput } from 'ink';
import { useKeyboardMode } from '@/hooks';

type Focus = 'list' | 'details';
type Tab = 'details' | 'explain' | 'trace' | 'patch';

interface UseReviewKeyboardOptions {
  focus: Focus;
  enabled?: boolean;

  // Navigation
  onNavigate?: (direction: 'up' | 'down') => void;
  onNextIssue?: () => void;
  onPrevIssue?: () => void;

  // Actions
  onOpen?: () => void;
  onApply?: () => void;
  onIgnore?: () => void;

  // Tabs
  onShowTab?: (tab: Tab) => void;
  onCycleTab?: () => void;

  // Focus
  onToggleFocus?: () => void;
  onBack?: () => void;

  // Scroll (for details pane)
  onScroll?: (direction: 'up' | 'down') => void;
}

export function useReviewKeyboard(options: UseReviewKeyboardOptions) {
  const {
    focus,
    enabled = true,
    onNavigate,
    onNextIssue,
    onPrevIssue,
    onOpen,
    onApply,
    onIgnore,
    onShowTab,
    onCycleTab,
    onToggleFocus,
    onBack,
    onScroll,
  } = options;

  const { isKeyMode, isMenuMode } = useKeyboardMode();

  useInput((input, key) => {
    if (!enabled) return;

    // Normalize input
    const char = input.toLowerCase();

    // === KEY MODE ===
    if (isKeyMode) {
      if (focus === 'list') {
        // List navigation
        if (char === 'j' || key.downArrow) {
          onNavigate?.('down');
        } else if (char === 'k' || key.upArrow) {
          onNavigate?.('up');
        }
        // Actions
        else if (char === 'o' || key.return) {
          onOpen?.();
        } else if (char === 'a') {
          onApply?.();
        } else if (char === 'i') {
          onIgnore?.();
        }
        // Quick tabs
        else if (char === 'e') {
          onShowTab?.('explain');
        } else if (char === 't') {
          onShowTab?.('trace');
        }
        // Jump to next/prev open issue
        else if (char === 'n') {
          onNextIssue?.();
        } else if (char === 'p') {
          onPrevIssue?.();
        }
        // Focus switch
        else if (key.tab) {
          onToggleFocus?.();
        }
        // Back
        else if (key.escape || char === 'q') {
          onBack?.();
        }
      } else if (focus === 'details') {
        // Details scrolling
        if (char === 'j' || key.downArrow) {
          onScroll?.('down');
        } else if (char === 'k' || key.upArrow) {
          onScroll?.('up');
        }
        // Tab cycling
        else if (key.tab) {
          onCycleTab?.();
        }
        // Back to list
        else if (key.escape) {
          onToggleFocus?.();
        }
        // Quick actions still work from details
        else if (char === 'a') {
          onApply?.();
        } else if (char === 'i') {
          onIgnore?.();
        }
      }
    }
    // === MENU MODE ===
    else if (isMenuMode) {
      if (focus === 'list') {
        if (key.upArrow) {
          onNavigate?.('up');
        } else if (key.downArrow) {
          onNavigate?.('down');
        } else if (key.return) {
          onOpen?.();
        } else if (key.escape) {
          onBack?.();
        } else if (key.tab) {
          onToggleFocus?.();
        }
      } else if (focus === 'details') {
        if (key.upArrow) {
          onScroll?.('up');
        } else if (key.downArrow) {
          onScroll?.('down');
        } else if (key.tab) {
          onCycleTab?.();
        } else if (key.escape) {
          onToggleFocus?.();
        } else if (key.return) {
          onApply?.();
        }
      }
    }
  }, { isActive: enabled });
}

Update: apps/cli/src/features/review/hooks/index.ts
- Export useReviewKeyboard

Steps:
1. Create use-review-keyboard.ts
2. Export from index.ts
3. Run: npm run type-check

Output: Review keyboard handler
```

---

## Agent 2.3: Integrate Keyboard into Review

```
subagent_type: "react-component-architect"

Task: Wire keyboard handler into review components and update footer.

Modify: apps/cli/src/features/review/components/review-screen.tsx
(or review-split-screen.tsx)

Changes:
1. Add state for focus and activeTab
2. Import and use useReviewKeyboard
3. Wire all callbacks

Example:

import { useState, useCallback } from 'react';
import { useReviewKeyboard } from '../hooks';

function ReviewScreen({ issues, ... }) {
  const [focus, setFocus] = useState<'list' | 'details'>('list');
  const [activeTab, setActiveTab] = useState<'details' | 'explain' | 'trace' | 'patch'>('details');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailsScrollOffset, setDetailsScrollOffset] = useState(0);

  const selectedIssue = issues[selectedIndex];

  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    setSelectedIndex(prev => {
      if (direction === 'up') return Math.max(0, prev - 1);
      if (direction === 'down') return Math.min(issues.length - 1, prev + 1);
      return prev;
    });
  }, [issues.length]);

  const handleNextIssue = useCallback(() => {
    // Find next non-ignored issue
    const nextIndex = issues.findIndex((issue, i) =>
      i > selectedIndex && issue.status !== 'ignored'
    );
    if (nextIndex !== -1) setSelectedIndex(nextIndex);
  }, [issues, selectedIndex]);

  const handleToggleFocus = useCallback(() => {
    setFocus(prev => prev === 'list' ? 'details' : 'list');
  }, []);

  const handleCycleTab = useCallback(() => {
    const tabs: Tab[] = ['details', 'explain', 'trace', 'patch'];
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = (currentIndex + 1) % tabs.length;
    setActiveTab(tabs[nextIndex]);
  }, [activeTab]);

  useReviewKeyboard({
    focus,
    onNavigate: handleNavigate,
    onNextIssue: handleNextIssue,
    onPrevIssue: handlePrevIssue,
    onOpen: handleOpen,
    onApply: handleApply,
    onIgnore: handleIgnore,
    onShowTab: setActiveTab,
    onCycleTab: handleCycleTab,
    onToggleFocus: handleToggleFocus,
    onBack: handleBack,
    onScroll: (dir) => setDetailsScrollOffset(prev =>
      dir === 'down' ? prev + 1 : Math.max(0, prev - 1)
    ),
  });

  return (
    // ... render with focus state for styling
  );
}

---

Modify: apps/cli/src/components/ui/footer-bar.tsx

Changes:
1. Accept mode-aware shortcuts prop
2. Render different shortcuts based on mode

Example:

import { useKeyboardMode } from '@/hooks';

interface Shortcut {
  key: string;
  label: string;
}

interface FooterBarProps {
  menuShortcuts?: Shortcut[];
  keyShortcuts?: Shortcut[];
  status?: string;
}

export function FooterBar({ menuShortcuts, keyShortcuts, status }: FooterBarProps) {
  const { isKeyMode } = useKeyboardMode();
  const shortcuts = isKeyMode ? keyShortcuts : menuShortcuts;

  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
      <Box flexGrow={1}>
        {shortcuts?.map((s, i) => (
          <Text key={i}>
            <Text bold>{s.key}</Text>
            <Text dimColor> {s.label}  </Text>
          </Text>
        ))}
      </Box>
      {status && <Text dimColor>{status}</Text>}
    </Box>
  );
}

// Usage in review screen:
<FooterBar
  menuShortcuts={[
    { key: '↑/↓', label: 'Move' },
    { key: 'Enter', label: 'Open' },
    { key: 'Tab', label: 'Switch' },
    { key: 'Esc', label: 'Back' },
  ]}
  keyShortcuts={[
    { key: 'j/k', label: 'Move' },
    { key: 'o', label: 'Open' },
    { key: 'a', label: 'Apply' },
    { key: 'i', label: 'Ignore' },
    { key: 'e', label: 'Explain' },
    { key: 't', label: 'Trace' },
    { key: 'Tab', label: 'Focus' },
  ]}
  status="3 issues"
/>

---

Modify: apps/cli/src/app/app.tsx

Changes:
1. Add KeyboardModeProvider wrapper

Example:
import { KeyboardModeProvider } from '@/hooks';

function App() {
  return (
    <KeyboardModeProvider>
      <SessionRecorderProvider projectId={projectId}>
        {/* ... */}
      </SessionRecorderProvider>
    </KeyboardModeProvider>
  );
}

Steps:
1. Update review screen with keyboard integration
2. Update footer bar with mode-aware shortcuts
3. Add provider to app
4. Run: npm run type-check
5. Manual test: Enable key mode in settings, test all shortcuts

Output: Keyboard integrated into review
```

---

## Validation Checklist

After completing all agents:

- [ ] `npm run type-check` passes
- [ ] Settings shows controlsMode toggle
- [ ] Menu mode: Arrow keys + Enter work
- [ ] Key mode: j/k/o/a/i/e/t/n/p/Tab/Esc work
- [ ] Footer bar shows correct shortcuts for mode
- [ ] Focus styling shows which pane is active (if split-pane exists)

### Test Scenarios

1. **Menu Mode Navigation:**
   - Start in list, press ↑/↓ to move
   - Press Enter to open detail
   - Press Tab to switch focus
   - Press Esc to go back

2. **Key Mode Navigation:**
   - Start in list, press j/k to move
   - Press o to open detail
   - Press a to apply (should show confirm or do action)
   - Press i to ignore
   - Press n/p to jump to next/prev open issue
   - Press Tab to switch to details
   - In details, press Tab to cycle tabs
   - Press Esc to go back to list
