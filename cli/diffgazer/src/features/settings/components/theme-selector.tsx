import type { ReactElement } from "react";
import { RadioGroup } from "../../../components/ui/radio";

export type CliTheme = "auto" | "dark" | "light";

interface ThemeSelectorProps {
  value: CliTheme;
  onChange: (value: CliTheme) => void;
  onHighlightChange?: (value: CliTheme) => void;
  isActive?: boolean;
}

const THEME_OPTIONS: ReadonlyArray<{ value: CliTheme; label: string; description: string }> = [
  { value: "auto", label: "Auto", description: "Follow system preference" },
  { value: "dark", label: "Dark", description: "Dark background with light text" },
  { value: "light", label: "Light", description: "Light background with dark text" },
];

function isCliTheme(value: string): value is CliTheme {
  return value === "auto" || value === "dark" || value === "light";
}

export function ThemeSelector({
  value,
  onChange,
  onHighlightChange,
  isActive = true,
}: ThemeSelectorProps): ReactElement {
  return (
    <RadioGroup
      value={value}
      onChange={(next) => {
        if (isCliTheme(next)) onChange(next);
      }}
      onHighlightChange={(next) => {
        if (isCliTheme(next)) onHighlightChange?.(next);
      }}
      isActive={isActive}
    >
      {THEME_OPTIONS.map((opt) => (
        <RadioGroup.Item
          key={opt.value}
          value={opt.value}
          label={opt.label}
          description={opt.description}
        />
      ))}
    </RadioGroup>
  );
}
