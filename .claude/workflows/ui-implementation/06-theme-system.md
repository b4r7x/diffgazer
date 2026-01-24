# Workflow 06: Theme System

## Overview

Implement a complete theme system for the Ink CLI with support for Auto/Dark/Light/Terminal themes.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review using React 19 + Ink + Chalk.

### Theme Requirements
- 4 theme options: Auto, Dark, Light, Terminal default
- "Auto" works on any terminal background (no bg colors, uses reverse video)
- Theme stored in settings, loaded on app start
- All components use theme tokens (no hardcoded colors)

### Chalk Styling
- Chalk is used via Ink's Text color prop
- Supports: color names, hex, rgb, bold, dim, underline, inverse
- `chalk.supportsColor` for capability detection

---

## Task 1: Create Theme Module

**Agent:** `react-component-architect`

**File:** `apps/cli/src/lib/theme.ts`

### Implementation:

```typescript
import chalk, { ChalkInstance } from "chalk";

// Theme token interface
export interface ThemeTokens {
  // Text colors
  text: {
    normal: string;
    muted: string;
    accent: string;
    inverse: string;
  };

  // Status colors
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };

  // Severity colors
  severity: {
    blocker: string;
    high: string;
    medium: string;
    low: string;
    nit: string;
  };

  // UI elements
  ui: {
    border: string;
    borderFocused: string;
    selection: string;
    selectionText: string;
  };

  // Diff colors
  diff: {
    added: string;
    removed: string;
    context: string;
    header: string;
  };

  // Modifiers
  modifiers: {
    bold: boolean;
    dim: boolean;
    underline: boolean;
    inverse: boolean;
  };
}

// Auto theme - works on any background
const autoTheme: ThemeTokens = {
  text: {
    normal: "", // Default terminal color
    muted: "gray",
    accent: "cyan",
    inverse: "", // Will use inverse modifier
  },
  status: {
    success: "green",
    warning: "yellow",
    error: "red",
    info: "blue",
  },
  severity: {
    blocker: "red",
    high: "red",
    medium: "yellow",
    low: "blue",
    nit: "gray",
  },
  ui: {
    border: "gray",
    borderFocused: "cyan",
    selection: "", // Uses inverse
    selectionText: "",
  },
  diff: {
    added: "green",
    removed: "red",
    context: "gray",
    header: "cyan",
  },
  modifiers: {
    bold: true,
    dim: true,
    underline: true,
    inverse: true, // Key for Auto theme - selection via inverse
  },
};

// Dark theme - optimized for dark backgrounds
const darkTheme: ThemeTokens = {
  text: {
    normal: "white",
    muted: "#888888",
    accent: "#00d4ff",
    inverse: "black",
  },
  status: {
    success: "#00ff88",
    warning: "#ffaa00",
    error: "#ff4444",
    info: "#4488ff",
  },
  severity: {
    blocker: "#ff0000",
    high: "#ff4444",
    medium: "#ffaa00",
    low: "#4488ff",
    nit: "#888888",
  },
  ui: {
    border: "#444444",
    borderFocused: "#00d4ff",
    selection: "#00d4ff",
    selectionText: "black",
  },
  diff: {
    added: "#00ff88",
    removed: "#ff4444",
    context: "#888888",
    header: "#00d4ff",
  },
  modifiers: {
    bold: true,
    dim: true,
    underline: false, // Less visible on dark
    inverse: false,
  },
};

// Light theme - optimized for light backgrounds
const lightTheme: ThemeTokens = {
  text: {
    normal: "black",
    muted: "#666666",
    accent: "#0066cc",
    inverse: "white",
  },
  status: {
    success: "#006600",
    warning: "#996600",
    error: "#cc0000",
    info: "#0066cc",
  },
  severity: {
    blocker: "#cc0000",
    high: "#cc0000",
    medium: "#996600",
    low: "#0066cc",
    nit: "#666666",
  },
  ui: {
    border: "#cccccc",
    borderFocused: "#0066cc",
    selection: "#0066cc",
    selectionText: "white",
  },
  diff: {
    added: "#006600",
    removed: "#cc0000",
    context: "#666666",
    header: "#0066cc",
  },
  modifiers: {
    bold: true,
    dim: true,
    underline: true,
    inverse: false,
  },
};

// Terminal default - minimal styling
const terminalTheme: ThemeTokens = {
  text: {
    normal: "",
    muted: "",
    accent: "",
    inverse: "",
  },
  status: {
    success: "",
    warning: "",
    error: "",
    info: "",
  },
  severity: {
    blocker: "",
    high: "",
    medium: "",
    low: "",
    nit: "",
  },
  ui: {
    border: "",
    borderFocused: "",
    selection: "",
    selectionText: "",
  },
  diff: {
    added: "",
    removed: "",
    context: "",
    header: "",
  },
  modifiers: {
    bold: true, // Only bold for emphasis
    dim: false,
    underline: false,
    inverse: false,
  },
};

// Theme registry
export const themes: Record<string, ThemeTokens> = {
  auto: autoTheme,
  dark: darkTheme,
  light: lightTheme,
  terminal: terminalTheme,
};

// Get theme by name
export function getTheme(name: string): ThemeTokens {
  return themes[name] ?? themes.auto;
}

// Check if colors are supported
export function supportsColors(): boolean {
  return chalk.supportsColor !== false;
}

// Check if Unicode is supported (basic heuristic)
export function supportsUnicode(): boolean {
  return process.env.TERM !== "dumb" &&
         !process.env.TERM?.includes("linux") &&
         process.platform !== "win32";
}
```

---

## Task 2: Create Theme Context

**Agent:** `react-component-architect`

**File:** `apps/cli/src/hooks/use-theme.ts`

### Implementation:

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getTheme, ThemeTokens, themes } from "../lib/theme";
import { useSettings } from "./use-settings";

interface ThemeContextValue {
  theme: ThemeTokens;
  themeName: string;
  setTheme: (name: string) => void;
  availableThemes: string[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
}

export function ThemeProvider({ children, defaultTheme = "auto" }: ThemeProviderProps) {
  const { settings } = useSettings();
  const [themeName, setThemeName] = useState(settings?.theme ?? defaultTheme);

  useEffect(() => {
    if (settings?.theme) {
      setThemeName(settings.theme);
    }
  }, [settings?.theme]);

  const value: ThemeContextValue = {
    theme: getTheme(themeName),
    themeName,
    setTheme: setThemeName,
    availableThemes: Object.keys(themes),
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return auto theme as fallback
    return {
      theme: getTheme("auto"),
      themeName: "auto",
      setTheme: () => {},
      availableThemes: Object.keys(themes),
    };
  }
  return context;
}
```

---

## Task 3: Create Themed Text Component

**Agent:** `react-component-architect`

**File:** `apps/cli/src/components/ui/themed-text.tsx`

### Implementation:

```typescript
import { Text, TextProps } from "ink";
import { useTheme } from "../../hooks/use-theme";

type TextRole =
  | "normal"
  | "muted"
  | "accent"
  | "success"
  | "warning"
  | "error"
  | "info";

type SeverityLevel = "blocker" | "high" | "medium" | "low" | "nit";

interface ThemedTextProps extends Omit<TextProps, "color"> {
  role?: TextRole;
  severity?: SeverityLevel;
  selected?: boolean;
}

export function ThemedText({
  role = "normal",
  severity,
  selected,
  children,
  ...props
}: ThemedTextProps) {
  const { theme } = useTheme();

  // Determine color
  let color: string | undefined;
  if (severity) {
    color = theme.severity[severity];
  } else if (role !== "normal") {
    color = role === "success" || role === "warning" || role === "error" || role === "info"
      ? theme.status[role]
      : theme.text[role];
  } else {
    color = theme.text.normal || undefined;
  }

  // Handle selection with inverse
  const inverse = selected && theme.modifiers.inverse;
  const backgroundColor = selected && !inverse ? theme.ui.selection : undefined;

  return (
    <Text
      color={color || undefined}
      backgroundColor={backgroundColor || undefined}
      inverse={inverse}
      bold={props.bold ?? (selected && theme.modifiers.bold)}
      {...props}
    >
      {children}
    </Text>
  );
}
```

---

## Task 4: Apply Theme to Existing Components

**Agent:** `react-component-architect`

**Files to update:**

### 4.1 Badge Component
```typescript
// apps/cli/src/components/ui/badge.tsx
import { useTheme } from "../../hooks/use-theme";

export function Badge({ type, value }: BadgeProps) {
  const { theme } = useTheme();

  const getColor = () => {
    if (type === "severity") {
      return theme.severity[value as keyof typeof theme.severity];
    }
    if (type === "status") {
      return value === "configured" ? theme.status.success : theme.status.warning;
    }
    return theme.text.muted;
  };

  return (
    <Text color={getColor()} bold>
      [{value.toUpperCase()}]
    </Text>
  );
}
```

### 4.2 Card Component
```typescript
// apps/cli/src/components/ui/card.tsx
import { useTheme } from "../../hooks/use-theme";

export function Card({ title, focused, children, ...props }: CardProps) {
  const { theme } = useTheme();

  return (
    <Box
      borderStyle="round"
      borderColor={focused ? theme.ui.borderFocused : theme.ui.border}
      {...props}
    >
      {title && (
        <Text color={theme.text.accent} bold>
          {title}
        </Text>
      )}
      {children}
    </Box>
  );
}
```

### 4.3 Footer Bar Component
```typescript
// apps/cli/src/components/ui/footer-bar.tsx
import { useTheme } from "../../hooks/use-theme";

export function FooterBar({ shortcuts, status }: FooterBarProps) {
  const { theme } = useTheme();

  return (
    <Box justifyContent="space-between">
      <Box gap={2}>
        {shortcuts.map(({ key, label }) => (
          <Text key={key}>
            <Text color={theme.text.accent} bold>{key}</Text>
            <Text color={theme.text.muted}> {label}</Text>
          </Text>
        ))}
      </Box>
      {status && <Text color={theme.text.muted}>{status}</Text>}
    </Box>
  );
}
```

### 4.4 Issue Item Component
```typescript
// apps/cli/src/features/review/components/issue-item.tsx
import { useTheme } from "../../../hooks/use-theme";
import { ThemedText } from "../../../components/ui/themed-text";

export function IssueItem({ issue, selected }: IssueItemProps) {
  const { theme } = useTheme();

  return (
    <Box>
      <ThemedText severity={issue.severity} bold>
        [{issue.severity.toUpperCase()}]
      </ThemedText>
      <ThemedText selected={selected}>
        {issue.title}
      </ThemedText>
      <ThemedText role="muted">
        {issue.file}:{issue.lineStart}
      </ThemedText>
    </Box>
  );
}
```

### 4.5 Diff Display Component
```typescript
// apps/cli/src/components/git-diff-display.tsx
import { useTheme } from "../hooks/use-theme";

export function GitDiffDisplay({ diff }: Props) {
  const { theme } = useTheme();

  const getLineColor = (line: string) => {
    if (line.startsWith("+")) return theme.diff.added;
    if (line.startsWith("-")) return theme.diff.removed;
    if (line.startsWith("@@")) return theme.diff.header;
    return theme.diff.context;
  };

  // ... render diff lines with colors
}
```

---

## Task 5: Add Theme to App Root

**Agent:** `react-component-architect`

**File:** `apps/cli/src/app/app.tsx`

### Changes:

```typescript
import { ThemeProvider } from "../hooks/use-theme";

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
```

---

## Task 6: Theme Preview Component

**Agent:** `react-component-architect`

**File:** `apps/cli/src/components/wizard/theme-preview.tsx`

### Implementation:

```typescript
import { Box, Text } from "ink";
import { getTheme, ThemeTokens } from "../../lib/theme";

interface ThemePreviewProps {
  themeName: string;
}

export function ThemePreview({ themeName }: ThemePreviewProps) {
  const theme = getTheme(themeName);

  return (
    <Box flexDirection="column" gap={1}>
      <Text>Preview:</Text>
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={theme.text.normal}>Normal text</Text>
        <Text color={theme.text.muted}>Muted text</Text>
        <Text color={theme.text.accent} bold>Accent text (bold)</Text>
        <Text color={theme.status.success}>✓ Success message</Text>
        <Text color={theme.status.warning}>⚠ Warning message</Text>
        <Text color={theme.status.error}>✗ Error message</Text>
        <Box gap={1}>
          <Text color={theme.severity.high} bold>[HIGH]</Text>
          <Text color={theme.severity.medium} bold>[MEDIUM]</Text>
          <Text color={theme.severity.low} bold>[LOW]</Text>
        </Box>
      </Box>
    </Box>
  );
}
```

---

## Validation

After completing all tasks:

```bash
npm run type-check
```

Test each theme:
1. Set theme to "auto" - verify no background colors, inverse for selection
2. Set theme to "dark" - verify bright colors on dark background
3. Set theme to "light" - verify darker colors on light background
4. Set theme to "terminal" - verify minimal styling, only bold
