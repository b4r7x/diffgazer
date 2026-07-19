import {
  isSelectableTheme,
  SELECTABLE_THEME_OPTIONS,
  type SelectableTheme,
} from "@diffgazer/core/schemas/config";
import type { ReactElement } from "react";
import { RadioGroup } from "../../../components/ui/radio";

interface ThemeSelectorProps {
  value: SelectableTheme;
  onChange: (value: SelectableTheme) => void;
  onHighlightChange?: (value: SelectableTheme) => void;
  isActive?: boolean;
  onDownBoundary?: () => void;
}

export function ThemeSelector({
  value,
  onChange,
  onHighlightChange,
  isActive = true,
  onDownBoundary,
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
      wrap={!onDownBoundary}
      onNavigationBoundaryReached={(direction) => {
        if (direction === 1) onDownBoundary?.();
      }}
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
