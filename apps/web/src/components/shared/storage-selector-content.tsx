import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useId, useState } from "react";

export interface StorageSelectorContentProps {
  value: SecretsStorage | null;
  onChange: (value: SecretsStorage) => void;
  onEnter?: (value: SecretsStorage) => void;
  disabled?: boolean;
  keyboardNavigation?: boolean;
  autoFocusList?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

const STORAGE_OPTIONS: Array<{ value: SecretsStorage; label: string; description: string }> = [
  {
    value: "file",
    label: "File Storage (Local)",
    description:
      "Store secrets in a local file with OS file permissions (mode 0600). Simple and portable. For stronger protection, consider the system keyring.",
  },
  {
    value: "keyring",
    label: "System Keyring",
    description: "Use your operating system's secure keychain. Better security, system-integrated.",
  },
];

const STORAGE_VALUES = STORAGE_OPTIONS.map((option) => option.value);

function isStorageValue(value: string | null): value is SecretsStorage {
  return STORAGE_VALUES.some((storageValue) => storageValue === value);
}

export function StorageSelectorContent({
  value,
  onChange,
  onEnter,
  disabled = false,
  keyboardNavigation = true,
  autoFocusList = false,
  onBoundaryReached,
}: StorageSelectorContentProps) {
  const labelId = useId();
  const [focusedStorage, setFocusedStorage] = useState<SecretsStorage | null>(null);

  const navigationEnabled = !disabled && keyboardNavigation;
  const highlightedStorage = focusedStorage ?? value ?? STORAGE_OPTIONS[0]?.value ?? null;

  const handleChange = (nextValue: string) => {
    if (!isStorageValue(nextValue)) return;
    onChange(nextValue);
  };

  const handleEnter = (nextValue: string) => {
    if (!isStorageValue(nextValue)) return;
    onChange(nextValue);
    onEnter?.(nextValue);
  };

  return (
    <div className="space-y-3">
      <div id={labelId} className="text-sm font-mono text-tui-fg/60">
        Select Storage Method:
      </div>
      <RadioGroup
        value={value ?? undefined}
        onChange={handleChange}
        onEnter={handleEnter}
        highlighted={navigationEnabled ? highlightedStorage : null}
        onHighlightChange={(nextValue) => {
          if (isStorageValue(nextValue)) setFocusedStorage(nextValue);
        }}
        keyboardNavigation={navigationEnabled}
        activationMode="manual"
        onNavigationBoundaryReached={(direction, event) => {
          const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
          if (verticalDirection !== null) onBoundaryReached?.(verticalDirection);
        }}
        wrap={false}
        autoFocus={autoFocusList && navigationEnabled}
        aria-labelledby={labelId}
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
