import { useState, type KeyboardEvent } from "react";
import type { Theme } from '@diffgazer/core/schemas/config';
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";

export interface ThemeSelectorContentProps {
  value: Theme;
  onChange: (value: Theme) => void;
  focusedValue?: Theme | null;
  onFocusedValueChange?: (value: Theme) => void;
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
  focusedValue,
  onFocusedValueChange,
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

  const [internalHighlight, setInternalHighlight] = useState<Theme>(focusedValue ?? value);
  const rawHighlighted = focusedValue ?? internalHighlight;
  const highlighted = isThemeOption(rawHighlighted, optionValues)
    ? rawHighlighted
    : optionValues[0]!;

  const handleNavigate = (nextValue: string) => {
    if (!isThemeOption(nextValue, optionValues)) return;

    setInternalHighlight(nextValue);
    onFocusedValueChange?.(nextValue);
    onFocus?.(nextValue);
  };

  const handleChange = (nextValue: string) => {
    if (isThemeOption(nextValue, optionValues)) onChange(nextValue);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return;

    if (e.key === " " && highlighted) {
      e.preventDefault();
      onSelect?.(highlighted);
      return;
    }
    if (e.key === "Enter" && highlighted) {
      e.preventDefault();
      if (onEnter) onEnter(highlighted);
      else onSelect?.(highlighted);
      return;
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-[--tui-fg]/60">Select Interface Theme:</div>
      <RadioGroup
        value={value}
        onChange={handleChange}
        onNavigate={handleNavigate}
        onKeyDown={handleKeyDown}
        highlighted={enabled ? highlighted : null}
        keyboardNavigation={enabled}
        activationMode="manual"
        onNavigationBoundaryReached={(direction) => {
          onBoundaryReached?.(direction === "previous" ? "up" : "down");
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
