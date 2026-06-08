import {
  isSelectableTheme,
  SELECTABLE_THEME_OPTIONS,
  type SelectableTheme,
} from "@diffgazer/core/schemas/config";
import type { ReactElement } from "react";
import { RadioGroup } from "../../../components/ui/radio";

export type CliTheme = SelectableTheme;

interface ThemeSelectorProps {
  value: CliTheme;
  onChange: (value: CliTheme) => void;
  onHighlightChange?: (value: CliTheme) => void;
  isActive?: boolean;
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
        if (isSelectableTheme(next)) onChange(next);
      }}
      onHighlightChange={(next) => {
        if (isSelectableTheme(next)) onHighlightChange?.(next);
      }}
      isActive={isActive}
    >
      {SELECTABLE_THEME_OPTIONS.map((opt) => (
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
