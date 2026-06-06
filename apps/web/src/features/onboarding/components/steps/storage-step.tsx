import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { StorageSelectorContent } from "@/components/shared/storage-selector-content";

interface StorageStepProps {
  value: SecretsStorage | null;
  onChange: (value: SecretsStorage) => void;
  onCommit?: (value: SecretsStorage) => void;
  keyboardNavigation?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function StorageStep({
  value,
  onChange,
  onCommit,
  keyboardNavigation = true,
  onBoundaryReached,
}: StorageStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Choose where Diffgazer stores your API keys and secrets.
      </p>
      <StorageSelectorContent
        value={value}
        onChange={onChange}
        onEnter={onCommit}
        keyboardNavigation={keyboardNavigation}
        autoFocusList={keyboardNavigation}
        onBoundaryReached={onBoundaryReached}
      />
    </div>
  );
}
