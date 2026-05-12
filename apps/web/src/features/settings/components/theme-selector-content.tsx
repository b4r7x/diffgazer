import { useState, type KeyboardEvent } from "react";
import type { Theme } from '@diffgazer/core/schemas/config';
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";

export interface ThemeSelectorContentProps {
  value: Theme;
  onChange: (value: Theme) => void;
  highlighted?: Theme | null;
  onHighlightChange?: (value: Theme) => void;
  onPreviewValueChange?: (value: Theme | null) => void;
  onSelect?: (value: Theme) => void;
  onEnter?: (value: Theme) => void;
  onFocus?: (value: Theme) => void;
  onBoundaryReached?: (direction: "up" | "down") => void;
  enabled?: boolean;
  showTerminalOption?: boolean;
}

const THEME_OPTIONS: Array<{ value: Theme; label: string; description: string }> = [
  { value: 'auto', label: 'Auto', description: 'Follow system preference' },
  { value: 'dark', label: 'Dark', description: 'Dark background with light text' },
  { value: 'light', label: 'Light', description: 'Light background with dark text' },
  { value: 'terminal', label: 'Terminal Default', description: 'Use terminal default colors' },
];

function isThemeOption(value: string | null, optionValues: Theme[]): value is Theme {
  return optionValues.some((optionValue) => optionValue === value);
}

export function ThemeSelectorContent({
  value,
  onChange,
  highlighted,
  onHighlightChange,
  onPreviewValueChange,
  onSelect,
  onEnter,
  onFocus,
  onBoundaryReached,
  enabled = true,
  showTerminalOption = false
}: ThemeSelectorContentProps) {
  const options = showTerminalOption
    ? THEME_OPTIONS
    : THEME_OPTIONS.filter(opt => opt.value !== 'terminal');
  const optionValues = options.map((option) => option.value);

  const [internalHighlight, setInternalHighlight] = useState<Theme>(highlighted ?? value);
  const rawHighlighted = highlighted ?? internalHighlight;
  const effectiveHighlighted = isThemeOption(rawHighlighted, optionValues)
    ? rawHighlighted
    : optionValues[0]!;

  const handleHighlightChange = (nextValue: string | null) => {
    if (nextValue === null) return;
    if (!isThemeOption(nextValue, optionValues)) return;

    setInternalHighlight(nextValue);
    onHighlightChange?.(nextValue);
    onFocus?.(nextValue);
  };

  const handleChange = (nextValue: string) => {
    if (isThemeOption(nextValue, optionValues)) onChange(nextValue);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return;

    if (e.key === " " && effectiveHighlighted) {
      e.preventDefault();
      onSelect?.(effectiveHighlighted);
      return;
    }
    if (e.key === "Enter" && effectiveHighlighted) {
      e.preventDefault();
      if (onEnter) onEnter(effectiveHighlighted);
      else onSelect?.(effectiveHighlighted);
      return;
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-[--tui-fg]/60">Select Interface Theme:</div>
      <RadioGroup
        value={value}
        onChange={handleChange}
        onHighlightChange={handleHighlightChange}
        onKeyDown={handleKeyDown}
        highlighted={enabled ? effectiveHighlighted : null}
        keyboardNavigation={enabled}
        activationMode="manual"
        onNavigationBoundaryReached={(direction, event) => {
          const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
          if (verticalDirection !== null) onBoundaryReached?.(verticalDirection);
        }}
        autoFocus={enabled}
        wrap={false}
      >
        {options.map((option) => (
          <div
            key={option.value}
            onMouseEnter={() => onPreviewValueChange?.(option.value)}
            onMouseLeave={() => onPreviewValueChange?.(null)}
          >
            <RadioGroupItem
              value={option.value}
              label={option.label}
              description={option.description}
            />
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
