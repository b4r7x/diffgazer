import { cn } from "@diffgazer/ui/lib/utils";
import { useTheme } from "@/hooks/theme-context";

const focusRingClassName =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      className={cn(
        "px-1 uppercase transition-colors hover:bg-secondary hover:text-foreground",
        focusRingClassName,
      )}
    >
      {nextTheme}
    </button>
  );
}
