# UI Screens

Stargazer CLI screens and their purpose.

## Screen Overview

| Screen | Purpose | Entry |
|--------|---------|-------|
| Onboarding | AI provider setup | First run |
| Settings | User preferences | `s` from main |
| Main Menu | Navigation hub | Default |
| Review | Issue list + details | `r` from main |
| History | Past reviews | `h` from main |
| Sessions | Session list | Resume mode |
| Trust Wizard | Project permissions | New project |

## Screen Files

```
apps/cli/src/app/screens/
├── onboarding-screen.tsx
├── settings-screen.tsx
├── history-screen.tsx
├── sessions-screen.tsx
├── review-history-screen.tsx
└── trust-wizard-screen.tsx

apps/cli/src/app/views/
├── main-menu-view.tsx
└── review-view.tsx
```

## Onboarding Screen

First-run setup for AI provider configuration.

### Flow

1. Select AI provider (Gemini, OpenAI, Anthropic)
2. Enter API key
3. Select model
4. Verify connection
5. Save configuration

### States

| State | Display |
|-------|---------|
| `provider-select` | Provider selection list |
| `api-key-input` | API key input field |
| `model-select` | Model selection list |
| `verifying` | Connection test spinner |
| `complete` | Success message |
| `error` | Error with retry option |

## Settings Screen

User preferences configuration.

### Sections

| Section | Options |
|---------|---------|
| Theme | auto, dark, light, terminal |
| Controls | menu, keys |
| Default Lenses | Checkbox list |
| Default Profile | Select or none |
| Severity Threshold | Severity level select |

### Keyboard

| Key | Action |
|-----|--------|
| `j/k` | Navigate sections |
| `Enter` | Edit section |
| `Escape` | Cancel/Back |
| `s` | Save changes |

## Main Menu View

Central navigation hub.

### Options

| Key | Option | Destination |
|-----|--------|-------------|
| `r` | Start Review | Review view |
| `h` | Review History | History screen |
| `d` | View Diff | Diff display |
| `g` | Git Status | Status display |
| `s` | Settings | Settings screen |
| `q` | Quit | Exit app |

### Layout

```
+----------------------------------+
| Stargazer - AI Code Review       |
+----------------------------------+
| Project: /path/to/repo           |
| Branch: feature/review           |
| Changes: 5 files (staged)        |
+----------------------------------+
| [r] Start Review                 |
| [h] Review History               |
| [d] View Diff                    |
| [s] Settings                     |
| [q] Quit                         |
+----------------------------------+
```

## Review View

Split-pane review interface.

### Layout

```
+---------------+------------------+
| Issues        | Details          |
+---------------+------------------+
| > Bug: null   | Title: Bug...    |
|   Perf: loop  | File: src/api.ts |
|   Sec: inject | Line: 42         |
|               |                  |
|               | Description:     |
|               | The variable...  |
|               |                  |
|               | Suggested fix:   |
|               | Add null check   |
+---------------+------------------+
| j/k: nav  Enter: drilldown  q: back |
+-------------------------------------+
```

### Components

| Component | Purpose |
|-----------|---------|
| `IssueListPane` | Left panel with issue list |
| `IssueDetailsPane` | Right panel with details |
| `IssueTabs` | Tab bar (Details, Explain, Trace, Patch) |
| `IssueBody*` | Tab content components |
| `ReviewSplitScreen` | Main layout container |

### Tabs

| Tab | Content |
|-----|---------|
| Details | Issue description, location, suggestion |
| Explain | AI-generated explanation (drilldown) |
| Trace | Code flow trace (drilldown) |
| Patch | Suggested code patch (drilldown) |

### Keyboard

| Key | Action |
|-----|--------|
| `j/k` | Navigate issues |
| `Tab` | Switch tabs |
| `Enter` | Drilldown issue |
| `a` | Apply patch |
| `i` | Ignore issue |
| `Escape` | Back to main |

## History Screen

List of past reviews.

### Display

| Column | Content |
|--------|---------|
| Date | Review timestamp |
| Status | Staged/Unstaged |
| Issues | Issue count |
| Lenses | Used lenses |

### Actions

| Key | Action |
|-----|--------|
| `Enter` | Open review |
| `d` | Delete review |
| `Escape` | Back |

## Sessions Screen

Session picker for resume functionality.

### Display

| Column | Content |
|--------|---------|
| ID | Session ID (truncated) |
| Created | Creation time |
| Events | Event count |

### Actions

| Key | Action |
|-----|--------|
| `Enter` | Resume session |
| `n` | New session |
| `d` | Delete session |
| `Escape` | Cancel |

## Trust Wizard Screen

Project permission configuration.

### Flow

1. Display project path
2. Select capabilities (checkboxes)
3. Select trust mode (persistent/session)
4. Confirm and save

### Capabilities

| Capability | Description |
|------------|-------------|
| Read Files | Access to project files |
| Read Git | Access to git history |
| Run Commands | Execute shell commands |

## State Management

Screens use the app-level state machine:

```typescript
import { useNavigation } from "@/features/app/hooks/use-navigation";

function SomeScreen() {
  const { navigate, goBack } = useNavigation();

  const handleComplete = () => {
    navigate("main");
  };

  const handleCancel = () => {
    goBack();
  };
}
```

## Cross-References

- [UI: Components](./components.md) - Component library
- [UI: Navigation](./navigation.md) - Navigation flow
- [Reference: CLI Commands](../reference/cli-commands.md) - Keyboard shortcuts
