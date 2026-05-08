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

function isThemeOption(value: Theme | null, optionValues: Theme[]): value is Theme {
  return optionValues.includes(value as Theme);
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

  const handleHighlightChange = (nextValue: string | null) => {
    if (!isThemeOption(nextValue as Theme | null, optionValues)) return;

    const theme = nextValue as Theme;
    setInternalHighlight(theme);
    onFocusedValueChange?.(theme);
    onFocus?.(theme);
  };

  const moveHighlight = (delta: -1 | 1) => {
    const currentIndex = optionValues.indexOf(highlighted);
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0) {
      onBoundaryReached?.("up");
      return;
    }
    if (nextIndex >= optionValues.length) {
      onBoundaryReached?.("down");
      return;
    }
    handleHighlightChange(optionValues[nextIndex]!);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return;
    const lastValue = options[options.length - 1]?.value;
    const firstValue = options[0]?.value;

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
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      if (highlighted === lastValue) {
        onBoundaryReached?.("down");
        return;
      }
      moveHighlight(1);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (highlighted === firstValue) {
        onBoundaryReached?.("up");
        return;
      }
      moveHighlight(-1);
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
