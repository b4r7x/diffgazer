import {
  isSecretsStorage,
  SECRETS_STORAGE_OPTIONS,
  type SecretsStorage,
} from "@diffgazer/core/schemas/config";
import type { ReactElement } from "react";
import { RadioGroup } from "../ui/radio";

interface StorageSelectorProps {
  value?: SecretsStorage | null;
  onChange?: (value: SecretsStorage) => void;
  isActive?: boolean;
  onDownBoundary?: () => void;
}

export function StorageSelector({
  value,
  onChange,
  isActive = true,
  onDownBoundary,
}: StorageSelectorProps): ReactElement {
  return (
    <RadioGroup
      value={value ?? undefined}
      onChange={(nextValue) => {
        if (isSecretsStorage(nextValue)) onChange?.(nextValue);
      }}
      isActive={isActive}
      wrap={!onDownBoundary}
      onNavigationBoundaryReached={(direction) => {
        if (direction === 1) onDownBoundary?.();
      }}
    >
      {SECRETS_STORAGE_OPTIONS.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          label={option.label}
          description={option.description}
        />
      ))}
    </RadioGroup>
  );
}
