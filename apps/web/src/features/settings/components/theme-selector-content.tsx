import type { Theme } from '@stargazer/schemas/config';
import { RadioGroup, RadioGroupItem } from '@/components/ui/form';

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
  const options = showTerminalOption
    ? THEME_OPTIONS
    : THEME_OPTIONS.filter(opt => opt.value !== 'terminal');

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-[--tui-fg]/60">Select Interface Theme:</div>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as Theme)}
        onFocus={onFocus ? (v) => onFocus(v as Theme) : undefined}
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
