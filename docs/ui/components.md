# UI Components

Component library for the Stargazer CLI built with React Ink.

## Component Overview

| Component | Purpose |
|-----------|---------|
| `Badge` | Colored label for status/severity |
| `Card` | Content container with optional border |
| `FooterBar` | Bottom bar with keyboard shortcuts |
| `HeaderBrand` | App logo and title header |
| `SelectList` | Keyboard-navigable list selection |
| `Separator` | Visual divider line |
| `SplitPane` | Two-column layout |
| `StatusCard` | Status message with icon |
| `ToggleList` | Multi-select toggle list |

## Import

```typescript
import {
  Badge,
  SeverityBadge,
  StatusBadge,
  Card,
  FooterBar,
  FooterBarWithDivider,
  HeaderBrand,
  CompactBrand,
  SelectList,
  Separator,
  SplitPane,
  StatusCard,
  ToggleList,
} from "@/components/ui";
```

## Badge

Displays a colored label.

```typescript
interface BadgeProps {
  children: React.ReactNode;
  color?: string;
}
```

### Variants

**SeverityBadge** - Colors based on severity level:

```tsx
<SeverityBadge severity="blocker" />  // Red
<SeverityBadge severity="high" />     // Red
<SeverityBadge severity="medium" />   // Yellow
<SeverityBadge severity="low" />      // Cyan
<SeverityBadge severity="nit" />      // Gray
```

**StatusBadge** - Colors based on status:

```tsx
<StatusBadge status="success" />  // Green
<StatusBadge status="error" />    // Red
<StatusBadge status="pending" />  // Yellow
```

## Card

Content container with optional styling.

```typescript
interface CardProps {
  children: React.ReactNode;
  title?: string;
  borderColor?: string;
  padding?: number;
}
```

```tsx
<Card title="Review Summary" borderColor="green">
  <Text>3 issues found</Text>
</Card>
```

## FooterBar

Bottom bar displaying keyboard shortcuts.

```typescript
interface Shortcut {
  key: string;
  label: string;
}

interface FooterBarProps {
  shortcuts: Shortcut[];
}
```

```tsx
<FooterBar
  shortcuts={[
    { key: "j/k", label: "Navigate" },
    { key: "Enter", label: "Select" },
    { key: "q", label: "Quit" },
  ]}
/>
```

**FooterBarWithDivider** - Includes a separator line above.

## HeaderBrand

Application header with logo.

```tsx
<HeaderBrand />
// Displays: Stargazer - AI Code Review
```

**CompactBrand** - Minimal version for tight spaces.

## SelectList

Keyboard-navigable selection list.

```typescript
interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SelectListProps<T> {
  options: SelectOption<T>[];
  selectedIndex: number;
  onSelect: (value: T, index: number) => void;
  onIndexChange?: (index: number) => void;
  showIndex?: boolean;
}
```

```tsx
const [index, setIndex] = useState(0);

<SelectList
  options={[
    { value: "correctness", label: "Correctness", description: "Bugs and logic errors" },
    { value: "security", label: "Security", description: "Vulnerabilities" },
  ]}
  selectedIndex={index}
  onIndexChange={setIndex}
  onSelect={(value) => console.log("Selected:", value)}
/>
```

## Separator

Horizontal line separator.

```typescript
interface SeparatorProps {
  character?: string;
  color?: string;
}
```

```tsx
<Separator />
<Separator character="=" color="gray" />
```

## SplitPane

Two-column layout for master-detail views.

```typescript
interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: number | string;  // Default: "40%"
  gap?: number;                 // Default: 1
}
```

```tsx
<SplitPane
  left={<IssueList issues={issues} />}
  right={<IssueDetails issue={selectedIssue} />}
  leftWidth="35%"
/>
```

## StatusCard

Displays a status message with icon.

```typescript
interface StatusCardProps {
  status: "loading" | "success" | "error" | "info";
  title: string;
  description?: string;
}
```

```tsx
<StatusCard
  status="loading"
  title="Analyzing code..."
  description="Running correctness lens"
/>

<StatusCard
  status="success"
  title="Review complete"
  description="3 issues found"
/>

<StatusCard
  status="error"
  title="Review failed"
  description="API key not configured"
/>
```

## ToggleList

Multi-select toggle list with checkboxes.

```typescript
interface ToggleOption<T = string> {
  value: T;
  label: string;
  description?: string;
}

interface ToggleListProps<T> {
  options: ToggleOption<T>[];
  selected: T[];
  focusedIndex: number;
  onToggle: (value: T) => void;
  onFocusChange?: (index: number) => void;
}
```

```tsx
const [selected, setSelected] = useState<string[]>(["correctness"]);
const [focusedIndex, setFocusedIndex] = useState(0);

<ToggleList
  options={[
    { value: "correctness", label: "Correctness" },
    { value: "security", label: "Security" },
    { value: "performance", label: "Performance" },
  ]}
  selected={selected}
  focusedIndex={focusedIndex}
  onFocusChange={setFocusedIndex}
  onToggle={(value) => {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }}
/>
```

## Keyboard Navigation

Components follow consistent keyboard patterns:

| Key | Action |
|-----|--------|
| `j` / `Down` | Move down |
| `k` / `Up` | Move up |
| `Enter` / `Space` | Select/Toggle |
| `Escape` | Cancel/Back |

## Theming

Components respect the app theme:

```typescript
import { useTheme } from "@/hooks/use-theme";

function MyComponent() {
  const { colors } = useTheme();
  return <Text color={colors.primary}>Themed text</Text>;
}
```

Theme options: `auto`, `dark`, `light`, `terminal`

## Cross-References

- [UI: Screens](./screens.md) - Screen compositions
- [UI: Navigation](./navigation.md) - Navigation patterns
- [Apps: CLI](../apps/cli.md) - CLI app structure
