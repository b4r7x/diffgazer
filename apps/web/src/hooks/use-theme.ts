import { useContext } from "react";
import { ThemeContext } from "@/app/providers/theme";
import type { ThemeContextValue } from "@/types/theme";

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
