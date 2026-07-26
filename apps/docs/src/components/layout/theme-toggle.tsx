import { cn } from "@diffgazer/ui/lib/utils";
import { CHROME_ACTION_TARGET_CLASS } from "@/components/shared/chrome-label";
import { nextThemePreference, themeToggleLabel, useTheme } from "@/hooks/theme-context";

const focusRingClassName =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type="button"
      data-docs-theme-toggle=""
      // suppressHydrationWarning: the head bootstrap's MutationObserver rewrites this
      // button's aria-label and its text child as the SSR markup is parsed, so both
      // differ from what the server sent. React's flag covers the element's own
      // attributes and its direct text child only — wrap a future non-text child and
      // the guard silently stops reaching it.
      suppressHydrationWarning
      onClick={() => setTheme(nextThemePreference(theme))}
      aria-label={themeToggleLabel(theme)}
      // The footer binds F2 to this same cycle; the binding is announced where
      // the control lives, not only in the footer hint row.
      aria-keyshortcuts="F2"
      title="Theme (F2)"
      className={cn(
        "px-1 uppercase transition-colors hover:bg-secondary hover:text-foreground pointer-coarse:px-2",
        CHROME_ACTION_TARGET_CLASS,
        focusRingClassName,
      )}
    >
      {theme}
    </button>
  );
}
