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
        label="File Storage (Local)"
        description="Store secrets in an encrypted file on your filesystem. Simple and portable."
      />
      <RadioGroup.Item
        value="keyring"
        label="System Keyring"
        description="Use your operating system's secure keychain. Better security, system-integrated."
      />
    </RadioGroup>
  );
}
