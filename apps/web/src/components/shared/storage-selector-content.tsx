import {
  isSecretsStorage,
  SECRETS_STORAGE_OPTIONS,
  type SecretsStorage,
} from "@diffgazer/core/schemas/config";
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
  const highlightedStorage = focusedStorage ?? value ?? SECRETS_STORAGE_OPTIONS[0]?.value ?? null;

  const handleChange = (nextValue: string) => {
    if (!isSecretsStorage(nextValue)) return;
    onChange(nextValue);
  };

  const handleEnter = (nextValue: string) => {
    if (!isSecretsStorage(nextValue)) return;
    onChange(nextValue);
    onEnter?.(nextValue);
  };

  return (
    <div className="space-y-3">
      <div id={labelId} className="text-sm font-mono text-foreground/60">
        Select Storage Method:
      </div>
      <RadioGroup
        value={value ?? undefined}
        onChange={handleChange}
        onEnter={handleEnter}
        highlighted={navigationEnabled ? highlightedStorage : null}
        onHighlightChange={(nextValue) => {
          if (isSecretsStorage(nextValue)) setFocusedStorage(nextValue);
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
        {SECRETS_STORAGE_OPTIONS.map((option) => (
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
