# Phase 5: Main Menu Redesign

## Problem

Per gpt-convo.md (lines 1307-1330), main menu should have:
- Proper menu items with shortcuts
- Status card showing provider/model, trust, last review

Current implementation is just a single line of text:
```
[g] Git Status [d] Git Diff [r] AI Review [h] Reviews [H] Sessions [S] Settings [q] Quit
```

---

## Target Layout (from gpt-convo.md)

```
┌─────────────────────────────────────────────────┐
│ ✦  S T A R G A Z E R  ✦                        │
│    *   .      ✧     .  *                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ Status ─────────────────────┐               │
│  │ Provider: Gemini (flash)     │               │
│  │ Trust: ✓ This directory      │               │
│  │ Last review: 2 hours ago     │               │
│  └──────────────────────────────┘               │
│                                                  │
│  Actions:                                        │
│  [r] Review unstaged changes                    │
│  [R] Review staged changes                      │
│  [f] Review specific files...                   │
│  [l] Resume last review                         │
│  [h] History                                    │
│  [s] Settings                                   │
│  [?] Help                                       │
│  [q] Quit                                       │
│                                                  │
├─────────────────────────────────────────────────┤
│ ↑/↓ select  Enter open  q quit                  │
└─────────────────────────────────────────────────┘
```

---

## Task 5.1: Create StatusCard Component

**File:** `apps/cli/src/components/ui/status-card.tsx`

```typescript
interface StatusCardProps {
  provider: string;
  model?: string;
  isTrusted: boolean;
  lastReviewAt?: string;
}

export function StatusCard({
  provider,
  model,
  isTrusted,
  lastReviewAt,
}: StatusCardProps) {
  const lastReviewText = lastReviewAt
    ? formatRelativeTime(lastReviewAt)
    : "Never";

  return (
    <Card title="Status">
      <Text>
        <Text dimColor>Provider: </Text>
        <Text>{provider}</Text>
        {model && <Text dimColor> ({model})</Text>}
      </Text>
      <Text>
        <Text dimColor>Trust: </Text>
        {isTrusted ? (
          <Text color="green">✓ This directory</Text>
        ) : (
          <Text color="yellow">Not trusted</Text>
        )}
      </Text>
      <Text>
        <Text dimColor>Last review: </Text>
        <Text>{lastReviewText}</Text>
      </Text>
    </Card>
  );
}
```

---

## Task 5.2: Redesign MainMenuView

**File:** `apps/cli/src/app/views/main-menu-view.tsx`

```typescript
interface MainMenuViewProps {
  provider: string;
  model?: string;
  isTrusted: boolean;
  lastReviewAt?: string;
  onSelect: (action: MenuAction) => void;
}

type MenuAction =
  | "review-unstaged"
  | "review-staged"
  | "review-files"
  | "resume-review"
  | "history"
  | "settings"
  | "help"
  | "quit";

const MENU_ITEMS: { key: string; label: string; action: MenuAction; description?: string }[] = [
  { key: "r", label: "Review unstaged changes", action: "review-unstaged" },
  { key: "R", label: "Review staged changes", action: "review-staged" },
  { key: "f", label: "Review specific files...", action: "review-files" },
  { key: "l", label: "Resume last review", action: "resume-review" },
  { key: "h", label: "History", action: "history" },
  { key: "s", label: "Settings", action: "settings" },
  { key: "?", label: "Help", action: "help" },
  { key: "q", label: "Quit", action: "quit" },
];

export function MainMenuView({
  provider,
  model,
  isTrusted,
  lastReviewAt,
  onSelect,
}: MainMenuViewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    // Direct key shortcuts
    const item = MENU_ITEMS.find(i => i.key === input);
    if (item) {
      onSelect(item.action);
      return;
    }

    // Arrow navigation
    if (key.upArrow || input === "k") {
      setSelectedIndex(i => Math.max(0, i - 1));
    }
    if (key.downArrow || input === "j") {
      setSelectedIndex(i => Math.min(MENU_ITEMS.length - 1, i + 1));
    }
    if (key.return) {
      onSelect(MENU_ITEMS[selectedIndex].action);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <HeaderBrand />

      <Box marginY={1}>
        <StatusCard
          provider={provider}
          model={model}
          isTrusted={isTrusted}
          lastReviewAt={lastReviewAt}
        />
      </Box>

      <Box flexDirection="column">
        <Text bold>Actions:</Text>
        <Box flexDirection="column" marginTop={1}>
          {MENU_ITEMS.map((item, index) => (
            <Box key={item.action}>
              <Text inverse={index === selectedIndex}>
                <Text color="cyan">[{item.key}]</Text>
                <Text> {item.label}</Text>
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Box marginTop={1}>
        <FooterBar shortcuts={["↑/↓ select", "Enter open", "q quit"]} />
      </Box>
    </Box>
  );
}
```

---

## Task 5.3: Update App.tsx for Menu Props

**File:** `apps/cli/src/app/app.tsx`

```typescript
{view === "main" && (
  <MainMenuView
    provider={state.config.currentConfig?.provider ?? "Not configured"}
    model={state.config.currentConfig?.model}
    isTrusted={!!state.trust.trust}
    lastReviewAt={state.reviewHistory.items[0]?.createdAt}
    onSelect={handlers.menu.onSelect}
  />
)}
```

---

## Task 5.4: Add Menu Handlers

**File:** `apps/cli/src/features/app/hooks/use-screen-handlers.ts`

```typescript
const menu = {
  onSelect: (action: MenuAction) => {
    switch (action) {
      case "review-unstaged":
        review.startReview({ staged: false });
        setView("review");
        break;
      case "review-staged":
        review.startReview({ staged: true });
        setView("review");
        break;
      case "review-files":
        // Open file picker
        setView("file-picker");
        break;
      case "resume-review":
        const lastReview = reviewHistory.items[0];
        if (lastReview) {
          reviewHistory.loadOne(lastReview.id);
          setView("review");
        }
        break;
      case "history":
        setView("review-history");
        break;
      case "settings":
        setView("settings");
        break;
      case "help":
        setView("help");
        break;
      case "quit":
        process.exit(0);
    }
  },
};
```

---

## Task 5.5: Create HeaderBrand Component

**File:** `apps/cli/src/components/ui/header-brand.tsx`

```typescript
import figlet from "figlet";

export function HeaderBrand() {
  const banner = figlet.textSync("STARGAZER", { font: "Small" });

  return (
    <Box flexDirection="column">
      <Text color="cyan">{banner}</Text>
      <Text dimColor>   ✦   *   .      ✧     .   ✦</Text>
    </Box>
  );
}
```

---

## Validation

Test:
1. Start stargazer (configured)
2. Should see status card with provider info
3. Press 'r' → should start review
4. Press 'R' → should start staged review
5. Arrow keys + Enter → should navigate and select
6. 'q' → should quit
