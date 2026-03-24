import type { ReactElement } from "react";
import { RadioGroup } from "../../../components/ui/radio.js";

interface StorageSelectorProps {
  value?: string;
  onChange?: (v: string) => void;
  isActive?: boolean;
}

export function StorageSelector({
  value,
  onChange,
  isActive = true,
}: StorageSelectorProps): ReactElement {
  return (
    <RadioGroup value={value} onChange={onChange} isActive={isActive}>
      <RadioGroup.Item
        value="file"
        label="File"
        description="Store secrets in ~/.diffgazer/config.json"
      />
      <RadioGroup.Item
        value="keyring"
        label="Keyring"
        description="Store secrets in OS keyring (macOS Keychain, etc.)"
      />
    </RadioGroup>
  );
}
