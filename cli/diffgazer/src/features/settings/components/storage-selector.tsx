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
        description="Store secrets in a local file with OS file permissions (mode 0600). Simple and portable. For stronger protection, consider the system keyring."
      />
      <RadioGroup.Item
        value="keyring"
        label="System Keyring"
        description="Use your operating system's secure keychain. Better security, system-integrated."
      />
    </RadioGroup>
  );
}
