import {
  isTheme,
  SELECTABLE_THEME_OPTIONS,
  THEME_OPTIONS,
  type Theme,
} from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { type KeyboardEvent, useState } from "react";

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
  showTerminalOption = false,
}: ThemeSelectorContentProps) {
  const options = showTerminalOption ? THEME_OPTIONS : SELECTABLE_THEME_OPTIONS;
  const optionValues = options.map((option) => option.value);

  const [internalHighlight, setInternalHighlight] = useState<Theme>(highlighted ?? value);
  const rawHighlighted = highlighted ?? internalHighlight;
  const effectiveHighlighted =
    isTheme(rawHighlighted) && optionValues.includes(rawHighlighted)
      ? rawHighlighted
      : (optionValues[0] ?? "auto");

  const handleHighlightChange = (nextValue: string | null) => {
    if (nextValue === null) return;
    if (!isTheme(nextValue) || !optionValues.includes(nextValue)) return;

    setInternalHighlight(nextValue);
    onHighlightChange?.(nextValue);
    onFocus?.(nextValue);
  };

  const handleChange = (nextValue: string) => {
    if (isTheme(nextValue) && optionValues.includes(nextValue)) onChange(nextValue);
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
      <div className="text-sm font-mono text-tui-fg/60">Select Interface Theme:</div>
      <RadioGroup
        aria-label="Select interface theme"
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
          // biome-ignore lint/a11y/noStaticElementInteractions: onMouseEnter/onMouseLeave drive a mouse-only hover preview over the keyboard-accessible RadioGroupItem; keyboard users select and preview through the radio itself.
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
