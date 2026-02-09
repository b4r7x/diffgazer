import { useRef } from "react";
import type { Theme } from '@diffgazer/schemas/config';
import { RadioGroup, RadioGroupItem } from '@diffgazer/ui';
import { useNavigation } from "@diffgazer/keyboard";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const options = showTerminalOption
    ? THEME_OPTIONS
    : THEME_OPTIONS.filter(opt => opt.value !== 'terminal');

  const notifyFocusedValueChange = (nextValue: Theme) => {
    onFocusedValueChange?.(nextValue);
    onFocus?.(nextValue);
  };

  const { focusedValue: navigationFocusedValue, focus } = useNavigation({
    containerRef,
    role: "radio",
    value: focusedValue ?? undefined,
    onValueChange: (nextValue) =>
      notifyFocusedValueChange(nextValue as Theme),
    initialValue: focusedValue ?? value,
    wrap: false,
    enabled,
    onSelect: onSelect as ((value: string) => void) | undefined,
    onEnter: onEnter as ((value: string) => void) | undefined,
    onBoundaryReached,
  });

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-[--tui-fg]/60">Select Interface Theme:</div>
      <RadioGroup
        ref={containerRef}
        value={value}
        onValueChange={onChange}
        onFocusChange={(nextValue) => focus(nextValue as Theme)}
        focusedValue={enabled ? navigationFocusedValue : null}
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
