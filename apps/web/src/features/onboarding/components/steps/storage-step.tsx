import { StorageSelectorContent } from "@/components/shared/storage-selector-content";
import type { SecretsStorage } from "@diffgazer/schemas/config";

interface StorageStepProps {
  value: SecretsStorage;
  onChange: (value: SecretsStorage) => void;
}

export function StorageStep({ value, onChange }: StorageStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Choose where Diffgazer stores your API keys and secrets.
      </p>
      <StorageSelectorContent value={value} onChange={onChange} />
    </div>
  );
}
