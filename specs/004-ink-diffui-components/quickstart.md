# Quickstart: Ink Component Library for CLI

**Branch**: `004-ink-diffui-components` | **Date**: 2026-03-24

## Prerequisites

- Node.js 20+
- pnpm 9+
- diffgazer workspace cloned with submodules (`pnpm run bootstrap`)

## Development

```bash
# From workspace root
cd diffgazer

# Install dependencies (if @inkjs/ui is added)
pnpm install

# Run CLI in dev mode
pnpm dev:cli

# Run web + CLI in parallel (for comparison)
pnpm dev
```

## Project Structure (CLI app)

```
apps/cli/src/
  app/
    routes.ts                          # Route discriminated union type
    navigation-context.tsx             # NavigationProvider + useNavigation hook
    router.tsx                         # ScreenRouter (switch on route)
    index.tsx                          # App root with provider tree
    screens/                           # Screen components (= web routes)
      home-screen.tsx
      onboarding-screen.tsx
      review-screen.tsx
      history-screen.tsx
      help-screen.tsx
      settings/
        hub-screen.tsx
        theme-screen.tsx
        providers-screen.tsx
        storage-screen.tsx
        analysis-screen.tsx
        agent-execution-screen.tsx
        diagnostics-screen.tsx
        trust-permissions-screen.tsx
    providers/
      server-provider.tsx              # Existing
      keyboard-provider.tsx            # TerminalKeyboardProvider (keyscope adapter)
      footer-provider.tsx              # Footer shortcut context
  components/
    ui/                                # Terminal component library
      badge.tsx
      button.tsx
      callout.tsx
      checkbox.tsx
      dialog.tsx
      empty-state.tsx
      input.tsx
      menu.tsx
      navigation-list.tsx
      panel.tsx
      radio.tsx
      scroll-area.tsx
      section-header.tsx
      spinner.tsx
      tabs.tsx
      toast.tsx
    layout/
      global-layout.tsx
      header.tsx
      footer.tsx
  features/                            # Feature modules (mirrors web)
    home/
      components/
      hooks/
    review/
      components/
      hooks/
    history/
      components/
      hooks/
    onboarding/
      components/
      hooks/
    providers/
      components/
      hooks/
    settings/
      components/
      hooks/
  hooks/
    use-back-handler.ts
    use-exit-handler.ts                # Existing
    use-servers.ts                     # Existing
    use-page-footer.ts
    use-terminal-dimensions.ts
  theme/
    palettes.ts                        # CliColorTokens + dark/light/high-contrast
    theme-context.tsx                  # CliThemeProvider + useTheme
  config/
    navigation.ts                      # Menu items, shortcuts (CLI-specific)
  lib/
    back-navigation.ts                 # getBackTarget (deterministic back rules)
  types/
    cli.ts                             # Existing
```

## Adding a New Terminal Component

1. Create `apps/cli/src/components/ui/{name}.tsx`
2. Mirror the diff-ui web component's prop interface (see `contracts/terminal-components.md`)
3. Use Ink primitives (Box, Text) + useTheme() for colors
4. Use `isActive` prop for input isolation when component has keyboard handlers
5. Export from barrel file if one exists

Example:

```tsx
import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";

interface BadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  children: ReactNode;
}

export function Badge({ variant = "neutral", children }: BadgeProps): ReactElement {
  const { tokens } = useTheme();
  const colorMap = {
    success: tokens.success,
    warning: tokens.warning,
    error: tokens.error,
    info: tokens.info,
    neutral: tokens.muted,
  };
  return <Text color={colorMap[variant]}>[{children}]</Text>;
}
```

## Adding a New Screen

1. Create `apps/cli/src/app/screens/{name}-screen.tsx`
2. Add route variant to `Route` union in `routes.ts`
3. Add entry to `SCREEN_MAP` in `router.tsx`
4. Add back-target rule in `lib/back-navigation.ts` if needed
5. Declare footer shortcuts via `usePageFooter({ shortcuts: [...] })`
6. Register keyscope scope via `useScope("screen-name")`

## Key Patterns

| Pattern | How |
|---------|-----|
| Read theme colors | `const { tokens } = useTheme()` |
| Handle keyboard input | `useInput((input, key) => { ... }, { isActive })` |
| Navigate to screen | `const { navigate } = useNavigation(); navigate({ screen: "review" })` |
| Go back | `const { goBack } = useNavigation(); goBack()` |
| Set footer shortcuts | `usePageFooter({ shortcuts: [{ key: "Enter", label: "Select" }] })` |
| Full-screen overlay | Conditional render: `{dialogOpen ? <Dialog /> : <NormalContent />}` |
| Scrollable list | Track `selectedIndex` + `scrollOffset` state, slice items array |
| Terminal dimensions | `const { stdout } = useStdout(); stdout.columns; stdout.rows` |
