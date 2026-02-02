# UI Navigation

Navigation patterns and state management for the Stargazer CLI.

## Navigation Flow

```
                    +------------+
                    | Onboarding |
                    +-----+------+
                          |
                          v
+--------+          +-----------+          +----------+
| Trust  |<-------->| Main Menu |<-------->| Settings |
| Wizard |          +-----+-----+          +----------+
+--------+                |
                          |
         +----------------+----------------+
         |                |                |
         v                v                v
    +---------+      +----------+     +----------+
    | History |      |  Review  |     |   Diff   |
    +---------+      +----+-----+     +----------+
         |                |
         v                v
    +---------+      +----------+
    | Detail  |      | Drilldown|
    +---------+      +----------+
```

## Screen Types

| Type | Behavior | Example |
|------|----------|---------|
| Modal | Overlays current screen | Settings |
| Replace | Replaces current screen | Main -> Review |
| Push | Adds to history stack | Review -> Drilldown |

## Navigation Hooks

### useNavigation

Primary navigation hook:

```typescript
import { useNavigation } from "@/features/app/hooks/use-navigation";

function MyScreen() {
  const {
    navigate,    // Navigate to screen
    goBack,      // Go to previous screen
    replace,     // Replace current screen
    canGoBack,   // Check if history exists
  } = useNavigation();

  const handleAction = () => {
    navigate("review");
  };

  const handleCancel = () => {
    if (canGoBack) {
      goBack();
    } else {
      navigate("main");
    }
  };
}
```

### useScreenHandlers

Screen-specific keyboard handlers:

```typescript
import { useScreenHandlers } from "@/features/app/hooks/use-screen-handlers";

function ReviewScreen() {
  useScreenHandlers({
    onEscape: () => navigate("main"),
    onQuit: () => exit(),
  });
}
```

## App State

The app uses a state machine for screen management:

```typescript
type AppScreen =
  | "loading"
  | "onboarding"
  | "main"
  | "review"
  | "history"
  | "settings"
  | "sessions"
  | "trust";

interface AppState {
  screen: AppScreen;
  previousScreen: AppScreen | null;
  history: AppScreen[];
}
```

### useAppState

Access and update app state:

```typescript
import { useAppState } from "@/features/app/hooks/use-app-state";

function App() {
  const {
    screen,           // Current screen
    setScreen,        // Set screen directly
    isConfigured,     // AI provider configured
    projectPath,      // Current project path
  } = useAppState();
}
```

### useAppInit

Initialize app on startup:

```typescript
import { useAppInit } from "@/features/app/hooks/use-app-init";

function App() {
  const { isLoading, error } = useAppInit();

  if (isLoading) return <Loading />;
  if (error) return <Error />;

  return <MainApp />;
}
```

## Keyboard Navigation

### Global Keys

Available on all screens:

| Key | Action |
|-----|--------|
| `Ctrl+C` | Force quit |
| `?` | Show help |

### Screen-Specific Keys

Defined per screen:

```typescript
function ReviewScreen() {
  useInput((input, key) => {
    if (key.escape) {
      navigate("main");
    }
    if (input === "j" || key.downArrow) {
      selectNext();
    }
    if (input === "k" || key.upArrow) {
      selectPrevious();
    }
  });
}
```

## Navigation Patterns

### Modal Pattern

For overlay screens that return to previous:

```typescript
function openSettings() {
  navigate("settings", { modal: true });
}

// In settings screen
function handleClose() {
  goBack(); // Returns to previous screen
}
```

### Wizard Pattern

For multi-step flows:

```typescript
function OnboardingWizard() {
  const [step, setStep] = useState(0);

  const steps = [
    <ProviderSelect />,
    <ApiKeyInput />,
    <ModelSelect />,
    <Confirmation />,
  ];

  return steps[step];
}
```

### Detail Pattern

For master-detail navigation:

```typescript
function HistoryScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <ReviewDetail
        id={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <ReviewList
      onSelect={setSelectedId}
    />
  );
}
```

## Focus Management

Focus is managed automatically by React Ink. Use `focus` prop for explicit control:

```typescript
<Box>
  <TextInput focus={isActive} />
  <Button focus={!isActive} />
</Box>
```

## Loading States

Standard loading pattern:

```typescript
function DataScreen() {
  const { data, isLoading, error } = useData();

  if (isLoading) {
    return <StatusCard status="loading" title="Loading..." />;
  }

  if (error) {
    return <StatusCard status="error" title={error.message} />;
  }

  return <DataDisplay data={data} />;
}
```

## Error Handling

Navigation errors are handled at the app level:

```typescript
function App() {
  const { error } = useAppState();

  if (error) {
    return (
      <ErrorScreen
        error={error}
        onRetry={() => location.reload()}
        onDismiss={() => navigate("main")}
      />
    );
  }

  return <CurrentScreen />;
}
```

## Cross-References

- [UI: Screens](./screens.md) - Screen descriptions
- [UI: Components](./components.md) - Component library
- [Reference: CLI Commands](../reference/cli-commands.md) - Full keyboard reference
