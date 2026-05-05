import { useState, type KeyboardEvent } from "react";
import type { SecretsStorage } from '@diffgazer/core/schemas/config';
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";

export interface StorageSelectorContentProps {
  value: SecretsStorage | null;
  onChange: (value: SecretsStorage) => void;
  onEnter?: (value: SecretsStorage) => void;
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

const FIRST_VALUE = STORAGE_OPTIONS[0]?.value ?? null;
const LAST_VALUE = STORAGE_OPTIONS[STORAGE_OPTIONS.length - 1]?.value ?? null;

export function StorageSelectorContent({
  value,
  onChange,
  onEnter,
  disabled = false,
  enabled = true,
  onBoundaryReached,
}: StorageSelectorContentProps) {
  const [highlighted, setHighlighted] = useState<string | null>(value);

  const navigationEnabled = !disabled && enabled;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && highlighted) {
      (onEnter ?? onChange)(highlighted as SecretsStorage);
      return;
    }
    if (onBoundaryReached) {
      if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && highlighted === FIRST_VALUE) {
        onBoundaryReached("up");
      } else if ((e.key === "ArrowDown" || e.key === "ArrowRight") && highlighted === LAST_VALUE) {
        onBoundaryReached("down");
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-[--tui-fg]/60">Select Storage Method:</div>
      <RadioGroup
        value={value ?? undefined}
        onChange={onChange as (value: string) => void}
        highlighted={navigationEnabled ? highlighted : null}
        onHighlightChange={setHighlighted}
        onKeyDown={handleKeyDown}
        wrap={false}
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
