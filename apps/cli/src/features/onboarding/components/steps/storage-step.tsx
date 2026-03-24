import type { ReactElement } from "react";
import { StorageSelector } from "../../../settings/components/storage-selector.js";

interface StorageStepProps {
  value?: string;
  onChange: (v: string) => void;
  isActive?: boolean;
}

export function StorageStep({
  value,
  onChange,
  isActive = true,
}: StorageStepProps): ReactElement {
  return (
    <StorageSelector
      value={value}
      onChange={onChange}
      isActive={isActive}
    />
  );
}
