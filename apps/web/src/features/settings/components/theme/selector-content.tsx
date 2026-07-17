import {
  isSelectableTheme,
  SELECTABLE_THEME_OPTIONS,
  type SelectableTheme,
} from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { type KeyboardEvent, useState } from "react";

export interface ThemeSelectorContentProps {
  value: SelectableTheme;
  onChange: (value: SelectableTheme) => void;
  highlighted?: SelectableTheme | null;
  onHighlightChange?: (value: SelectableTheme) => void;
  onPreviewValueChange?: (value: SelectableTheme | null) => void;
  onSelect?: (value: SelectableTheme) => void;
  onEnter?: (value: SelectableTheme) => void;
  onFocus?: (value: SelectableTheme) => void;
  onBoundaryReached?: (direction: "up" | "down") => void;
  enabled?: boolean;
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
}: ThemeSelectorContentProps) {
  const options = SELECTABLE_THEME_OPTIONS;
  const optionValues = options.map((option) => option.value);

  const [internalHighlight, setInternalHighlight] = useState<SelectableTheme>(highlighted ?? value);
  const rawHighlighted = highlighted ?? internalHighlight;
  const effectiveHighlighted = optionValues.includes(rawHighlighted)
    ? rawHighlighted
    : (optionValues[0] ?? "auto");

  const handleHighlightChange = (nextValue: string | null) => {
    if (nextValue === null) return;
    if (!isSelectableTheme(nextValue) || !optionValues.includes(nextValue)) return;

    setInternalHighlight(nextValue);
    onHighlightChange?.(nextValue);
    onFocus?.(nextValue);
  };

  const handleChange = (nextValue: string) => {
    if (isSelectableTheme(nextValue) && optionValues.includes(nextValue)) onChange(nextValue);
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
      <div className="text-sm font-mono text-foreground/60">Select Interface Theme:</div>
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
              onFocus={() => handleHighlightChange(option.value)}
            />
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
