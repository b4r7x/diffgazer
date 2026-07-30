import { SELECTABLE_THEME_OPTIONS } from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { type KeyboardEvent, useId, useState } from "react";
import { isWebTheme, type WebTheme } from "@/types/theme";

/** The shared list still carries Auto for the TUI; the web app renders only what it can apply. */
const THEME_OPTIONS = SELECTABLE_THEME_OPTIONS.flatMap((option) =>
  isWebTheme(option.value) ? [{ ...option, value: option.value }] : [],
);

export interface ThemeSelectorContentProps {
  value: WebTheme;
  onChange: (value: WebTheme) => void;
  highlighted?: WebTheme | null;
  onHighlightChange?: (value: WebTheme) => void;
  onPreviewValueChange?: (value: WebTheme | null) => void;
  onSelect?: (value: WebTheme) => void;
  onEnter?: (value: WebTheme) => void;
  onFocus?: (value: WebTheme) => void;
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
  const labelId = useId();

  const [internalHighlight, setInternalHighlight] = useState<WebTheme>(highlighted ?? value);
  const effectiveHighlighted = highlighted ?? internalHighlight;

  const handleHighlightChange = (nextValue: string | null) => {
    if (!isWebTheme(nextValue)) return;

    setInternalHighlight(nextValue);
    onHighlightChange?.(nextValue);
    onFocus?.(nextValue);
  };

  const handleChange = (nextValue: string) => {
    if (isWebTheme(nextValue)) onChange(nextValue);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return;

    if (e.key === " ") {
      e.preventDefault();
      onSelect?.(effectiveHighlighted);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (onEnter) onEnter(effectiveHighlighted);
      else onSelect?.(effectiveHighlighted);
      return;
    }
  };

  return (
    <div className="space-y-3">
      <SectionHeader id={labelId} as="h2" variant="muted">
        Interface Theme
      </SectionHeader>
      <RadioGroup
        aria-labelledby={labelId}
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
        {THEME_OPTIONS.map((option) => (
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
