import { useRef } from "react";
import type { Theme } from '@stargazer/schemas/config';
import { RadioGroup, RadioGroupItem } from '@stargazer/ui';
import { useNavigation } from "@stargazer/keyboard";

export interface ThemeSelectorContentProps {
  value: Theme;
  onChange: (value: Theme) => void;
  onFocus?: (value: Theme) => void;
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
  onFocus,
  showTerminalOption = false
}: ThemeSelectorContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const options = showTerminalOption
    ? THEME_OPTIONS
    : THEME_OPTIONS.filter(opt => opt.value !== 'terminal');

  const onChangeStr = onChange as (value: string) => void;

  const { focusedValue, focus } = useNavigation({
    containerRef,
    role: "radio",
    value,
    onValueChange: onChangeStr,
    onSelect: onChangeStr,
    onEnter: onChangeStr,
    onFocusChange: onFocus as ((value: string) => void) | undefined,
  });

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-[--tui-fg]/60">Select Interface Theme:</div>
      <RadioGroup
        ref={containerRef}
        value={value}
        onValueChange={onChange}
        onFocusChange={focus as (value: Theme) => void}
        focusedValue={focusedValue}
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
