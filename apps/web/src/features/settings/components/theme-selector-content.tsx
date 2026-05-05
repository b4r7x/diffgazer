import { useState, type KeyboardEvent } from "react";
import type { Theme } from '@diffgazer/core/schemas/config';
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";

export interface ThemeSelectorContentProps {
  value: Theme;
  onChange: (value: Theme) => void;
  focusedValue?: Theme | null;
  onFocusedValueChange?: (value: Theme) => void;
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

export function ThemeSelectorContent({
  value,
  onChange,
  focusedValue,
  onFocusedValueChange,
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

  const [internalHighlight, setInternalHighlight] = useState<Theme>(focusedValue ?? value);
  const highlighted = focusedValue ?? internalHighlight;

  const handleHighlightChange = (nextValue: string) => {
    const theme = nextValue as Theme;
    setInternalHighlight(theme);
    onFocusedValueChange?.(theme);
    onFocus?.(theme);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return;
    const lastValue = options[options.length - 1]?.value;
    const firstValue = options[0]?.value;

    if (e.key === " " && highlighted) {
      onSelect?.(highlighted);
      return;
    }
    if (e.key === "Enter" && highlighted) {
      if (onEnter) onEnter(highlighted);
      else onSelect?.(highlighted);
      return;
    }
    if (e.key === "ArrowDown" && highlighted === lastValue) {
      onBoundaryReached?.("down");
      return;
    }
    if (e.key === "ArrowUp" && highlighted === firstValue) {
      onBoundaryReached?.("up");
      return;
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-[--tui-fg]/60">Select Interface Theme:</div>
      <RadioGroup
        value={value}
        onChange={onChange as (value: string) => void}
        onHighlightChange={handleHighlightChange}
        onKeyDown={handleKeyDown}
        highlighted={enabled ? highlighted : null}
        wrap={false}
      >
        {options.map((option) => (
          <RadioGroupItem
            key={option.value}
            value={option.value}
            label={option.label}
            description={option.description}
          />
        ))}
      </RadioGroup>
    </div>
  );
}
