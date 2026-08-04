import { SELECTABLE_THEME_OPTIONS } from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useId } from "react";
import { SELECTED_OPTION_ROW } from "@/lib/selected-option-row";
import { isWebTheme, type WebTheme } from "@/types/theme";

export interface ThemeSelectorContentProps {
  value: WebTheme;
  onChange: (value: WebTheme) => void;
  /** Controlled highlight: the row the keyboard sits on and the row the preview follows. */
  highlighted: WebTheme;
  onHighlightChange: (value: WebTheme) => void;
  onPreviewValueChange?: (value: WebTheme | null) => void;
  onEnter?: (value: WebTheme) => void;
  onBoundaryReached?: (direction: "up" | "down") => void;
  enabled?: boolean;
}

export function ThemeSelectorContent({
  value,
  onChange,
  highlighted,
  onHighlightChange,
  onPreviewValueChange,
  onEnter,
  onBoundaryReached,
  enabled = true,
}: ThemeSelectorContentProps) {
  const labelId = useId();

  const handleHighlightChange = (nextValue: string | null) => {
    if (isWebTheme(nextValue)) onHighlightChange(nextValue);
  };

  const handleChange = (nextValue: string) => {
    if (isWebTheme(nextValue)) onChange(nextValue);
  };

  const handleEnter = (nextValue: string) => {
    if (isWebTheme(nextValue)) onEnter?.(nextValue);
  };

  return (
    <div className="space-y-3">
      <div id={labelId} className="font-mono text-sm text-muted-foreground">
        Select Interface Theme:
      </div>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onChange={handleChange}
        onEnter={handleEnter}
        onHighlightChange={handleHighlightChange}
        highlighted={enabled ? highlighted : null}
        keyboardNavigation={enabled}
        activationMode="manual"
        onNavigationBoundaryReached={(direction, event) => {
          const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
          if (verticalDirection !== null) onBoundaryReached?.(verticalDirection);
        }}
        autoFocus={enabled}
        wrap={false}
      >
        {SELECTABLE_THEME_OPTIONS.map((option) => (
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
              className={SELECTED_OPTION_ROW}
              onFocus={() => onHighlightChange(option.value)}
            />
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
