import {
  isSecretsStorage,
  SECRETS_STORAGE_OPTIONS,
  type SecretsStorage,
} from "@diffgazer/core/schemas/config";
import type { ReactElement } from "react";
import { RadioGroup } from "../ui/radio";

interface StorageSelectorProps {
  value?: SecretsStorage;
  onChange?: (value: SecretsStorage) => void;
  isActive?: boolean;
}

export function StorageSelector({
  value,
  onChange,
  isActive = true,
}: StorageSelectorProps): ReactElement {
  return (
    <RadioGroup
      value={value}
      onChange={(nextValue) => {
        if (isSecretsStorage(nextValue)) onChange?.(nextValue);
      }}
      isActive={isActive}
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
