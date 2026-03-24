# Terminal Component Contracts

**Branch**: `004-ink-diffui-components` | **Date**: 2026-03-24

These contracts define the public API for each terminal component. Components mirror diff-ui's web equivalents adapted for Ink 6 rendering.

## Shared Types

```typescript
type Variant = "success" | "warning" | "error" | "info" | "neutral";
type Size = "sm" | "md" | "lg";
```

## Badge

```typescript
interface BadgeProps {
  variant?: Variant;          // default: "neutral"
  size?: Size;                // default: "sm"
  dot?: boolean;              // colored dot prefix
  children: ReactNode;
}
// Renders: [LABEL] with ANSI color by variant
```

## Button

```typescript
interface ButtonProps {
  variant?: "primary" | "secondary" | "destructive" | "success" | "ghost" | "outline";
  size?: Size;
  bracket?: boolean;          // wraps in [ ]
  loading?: boolean;          // shows spinner, disables input
  disabled?: boolean;
  onPress?: () => void;
  children: ReactNode;
}
// Renders: [ Label ] or > Label with color by variant
```

## Callout

```typescript
interface CalloutProps {
  variant?: "info" | "warning" | "error" | "success";
  children: ReactNode;
}
interface CalloutTitleProps { children: ReactNode; }
interface CalloutContentProps { children: ReactNode; }
// Compound: Callout, Callout.Title, Callout.Content
// Renders: bordered Box with variant icon prefix (i, !, X, check)
```

## Checkbox / CheckboxGroup

```typescript
interface CheckboxProps {
  checked?: boolean | "indeterminate";
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  highlighted?: boolean;
  size?: Size;
}
// Renders: [x] Label / [ ] Label / [-] Label

interface CheckboxGroupProps<T extends string = string> {
  value?: T[];
  defaultValue?: T[];
  onChange?: (value: T[]) => void;
  onHighlightChange?: (value: string) => void;
  wrap?: boolean;
  disabled?: boolean;
  children: ReactNode;
}
interface CheckboxItemProps {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}
// Compound: CheckboxGroup, CheckboxGroup.Item
```

## Dialog (Full-Screen Overlay)

```typescript
interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}
interface DialogContentProps {
  children: ReactNode;
}
interface DialogHeaderProps { children: ReactNode; }
interface DialogTitleProps { children: ReactNode; }
interface DialogBodyProps { children: ReactNode; }
interface DialogFooterProps { children: ReactNode; }
// Compound: Dialog, Dialog.Content, Dialog.Header, Dialog.Title, Dialog.Body, Dialog.Footer
// Behavior: Takes over full terminal. Escape dismisses. Header/footer hidden.
```

## EmptyState

```typescript
interface EmptyStateProps {
  children: ReactNode;
}
interface EmptyStateMessageProps { children: ReactNode; }
interface EmptyStateDescriptionProps { children: ReactNode; }
// Compound: EmptyState, EmptyState.Message, EmptyState.Description
// Renders: centered text block
```

## Input

```typescript
interface InputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: Size;
  error?: boolean;
  disabled?: boolean;
  type?: "text" | "password";
}
// Uses @inkjs/ui TextInput or PasswordInput internally
```

## Menu

```typescript
interface MenuProps {
  selectedId?: string | null;
  highlightedId?: string | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  onClose?: () => void;
  variant?: "default" | "hub";
  wrap?: boolean;
  isActive?: boolean;         // controls useInput
  children: ReactNode;
}
interface MenuItemProps {
  id: string;
  disabled?: boolean;
  variant?: "default" | "danger";
  hotkey?: string | number;
  value?: ReactNode;          // right-side value (hub variant)
  children: ReactNode;
}
interface MenuDividerProps {}
// Compound: Menu, Menu.Item, Menu.Divider
// Renders: arrow-key navigable list, > indicator, inverted highlight
```

## NavigationList

```typescript
interface NavigationListProps {
  selectedId?: string | null;
  highlightedId?: string | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  focused?: boolean;
  wrap?: boolean;
  isActive?: boolean;
  children: ReactNode;
}
interface NavigationListItemProps {
  id: string;
  disabled?: boolean;
  children: ReactNode;
}
interface NavigationListTitleProps { children: ReactNode; }
interface NavigationListBadgeProps extends BadgeProps {}
interface NavigationListStatusProps { children: ReactNode; }
interface NavigationListSubtitleProps { children: ReactNode; }
// Compound: NavigationList, NavigationList.Item, .Title, .Badge, .Status, .Subtitle
// Renders: multi-column list with | selection indicator
```

## Panel

```typescript
interface PanelProps {
  variant?: "default" | "borderless";
  children: ReactNode;
}
interface PanelHeaderProps {
  variant?: "default" | "terminal" | "subtle";
  children: ReactNode;
}
interface PanelContentProps { children: ReactNode; }
interface PanelFooterProps { children: ReactNode; }
// Compound: Panel, Panel.Header, Panel.Content, Panel.Footer
// Renders: Box with borderStyle="round", optional header/footer
```

## RadioGroup

```typescript
interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onHighlightChange?: (value: string) => void;
  orientation?: "vertical" | "horizontal";
  wrap?: boolean;
  disabled?: boolean;
  children: ReactNode;
}
interface RadioGroupItemProps {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}
// Compound: RadioGroup, RadioGroup.Item
// Renders: ( * ) Selected / (   ) Unselected
```

## ScrollArea

```typescript
interface ScrollAreaProps {
  height: number;             // visible height in rows
  orientation?: "vertical" | "horizontal";
  isActive?: boolean;         // keyboard scrolling active
  children: ReactNode;
}
// Renders: managed viewport with offset tracking, up/down/pgup/pgdn
```

## SectionHeader

```typescript
interface SectionHeaderProps {
  variant?: "default" | "muted";
  bordered?: boolean;
  children: ReactNode;
}
// Renders: BOLD UPPERCASE text, optional bottom border (─ characters)
```

## Tabs

```typescript
interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}
interface TabsListProps {
  loop?: boolean;
  isActive?: boolean;
  children: ReactNode;
}
interface TabsTriggerProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}
interface TabsContentProps {
  value: string;
  children: ReactNode;
}
// Compound: Tabs, Tabs.List, Tabs.Trigger, Tabs.Content
// Renders: horizontal tab bar with arrow switching, active tab highlighted
```

## Toast

```typescript
// Imperative API (same as web)
function toast(title: string, options?: { message?: string; variant?: Variant; duration?: number }): string;
toast.success(title: string, options?): string;
toast.error(title: string, options?): string;
toast.warning(title: string, options?): string;
toast.dismiss(id?: string): void;

// Container component
interface ToasterProps {
  position?: "top" | "bottom";    // terminal: top or bottom row
}
// Renders: temporary Text notification, auto-dismiss after duration
```

## Spinner

```typescript
interface SpinnerProps {
  variant?: "dots" | "braille" | "snake";
  label?: ReactNode;
  size?: Size;
}
// Renders: animated unicode characters + optional label
// Uses ink-spinner or custom animation frames
```

## Layout Components (CLI-specific)

### Header

```typescript
interface HeaderProps {
  providerName: string;
  providerStatus: "active" | "idle";
  onBack?: () => void;        // undefined = no back button
}
// Renders: [<] Provider / Model    ┃ diffgazer
```

### Footer

```typescript
interface FooterProps {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
}
// Renders: [key] label  [key] label  ...  │  [key] label
```

### GlobalLayout

```typescript
interface GlobalLayoutProps {
  children: ReactNode;
}
// Renders: Header + content area (flex-grow) + Footer
// Fills terminal: useStdout().stdout.columns/rows
```
