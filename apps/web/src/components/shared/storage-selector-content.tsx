import { useRef } from "react";
import type { SecretsStorage } from '@stargazer/schemas/config';
import { RadioGroup, RadioGroupItem } from '@stargazer/ui';
import { useNavigation } from "@stargazer/keyboard";

export interface StorageSelectorContentProps {
  value: SecretsStorage | null;
  onChange: (value: SecretsStorage) => void;
  disabled?: boolean;
  enabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

const STORAGE_OPTIONS: Array<{ value: SecretsStorage; label: string; description: string }> = [
  {
    value: 'file',
    label: 'File Storage (Local)',
    description: 'Store secrets in an encrypted file on your filesystem. Simple and portable.',
  },
  {
    value: 'keyring',
    label: 'System Keyring',
    description: "Use your operating system's secure keychain. Better security, system-integrated.",
  },
];

export function StorageSelectorContent({
  value,
  onChange,
  disabled = false,
  enabled = true,
  onBoundaryReached,
}: StorageSelectorContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const onChangeStr = onChange as (value: string) => void;

  const navigationEnabled = !disabled && enabled;

  const { focusedValue } = useNavigation({
    containerRef,
    role: "radio",
    value,
    onValueChange: onChangeStr,
    onSelect: onChangeStr,
    onEnter: onChangeStr,
    enabled: navigationEnabled,
    wrap: false,
    onBoundaryReached,
  });

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-[--tui-fg]/60">Select Storage Method:</div>
      <RadioGroup
        ref={containerRef}
        value={value ?? undefined}
        onValueChange={onChange}
        focusedValue={navigationEnabled ? focusedValue : null}
        className="space-y-2"
        disabled={disabled}
      >
        {STORAGE_OPTIONS.map((option) => (
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
