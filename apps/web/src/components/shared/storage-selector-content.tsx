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
const STORAGE_VALUES = STORAGE_OPTIONS.map((option) => option.value);

function isStorageValue(value: string | null): value is SecretsStorage {
  return STORAGE_VALUES.includes(value as SecretsStorage);
}

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
  const effectiveHighlighted = isStorageValue(highlighted)
    ? highlighted
    : value ?? FIRST_VALUE;

  const handleChange = (nextValue: string) => {
    if (!isStorageValue(nextValue)) return;
    setHighlighted(nextValue);
    onChange(nextValue);
  };

  const moveHighlight = (delta: -1 | 1) => {
    if (!effectiveHighlighted) return;

    const currentIndex = STORAGE_VALUES.indexOf(effectiveHighlighted);
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0) {
      onBoundaryReached?.("up");
      return;
    }
    if (nextIndex >= STORAGE_VALUES.length) {
      onBoundaryReached?.("down");
      return;
    }
    setHighlighted(STORAGE_VALUES[nextIndex]!);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!navigationEnabled) return;

    if ((e.key === "Enter" || e.key === " ") && effectiveHighlighted) {
      e.preventDefault();
      (onEnter ?? onChange)(effectiveHighlighted);
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (effectiveHighlighted === FIRST_VALUE) {
        onBoundaryReached?.("up");
        return;
      }
      moveHighlight(-1);
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      if (effectiveHighlighted === LAST_VALUE) {
        onBoundaryReached?.("down");
        return;
      }
      moveHighlight(1);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-mono text-[--tui-fg]/60">Select Storage Method:</div>
      <RadioGroup
        value={value ?? undefined}
        onChange={handleChange}
        highlighted={navigationEnabled ? effectiveHighlighted : null}
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
