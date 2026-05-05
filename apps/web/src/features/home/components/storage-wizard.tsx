import { useState } from "react";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { CardLayout } from "@/components/ui/card-layout";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { StorageSelectorContent } from "@/components/shared/storage-selector-content";

export interface StorageWizardProps {
  initialValue?: SecretsStorage;
  onComplete: (choice: SecretsStorage) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function StorageWizard({
  initialValue = "file",
  onComplete,
  isLoading = false,
  error,
}: StorageWizardProps) {
  const [choice, setChoice] = useState<SecretsStorage>(initialValue);

  const handleSubmit = () => {
    onComplete(choice);
  };

  return (
    <CardLayout
      title="Configure Secrets Storage"
      subtitle="Choose where API keys and sensitive data should be stored."
      footer={
        <Button
          variant="success"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? "Saving..." : "Continue"}
        </Button>
      }
    >
      <div className="space-y-6">
        <StorageSelectorContent
          value={choice}
          onChange={setChoice}
          disabled={isLoading}
        />

        <Callout variant="info" layout="inline">
          You can change this setting later from the Settings menu.
        </Callout>

        {error && (
          <p className="text-tui-red text-sm">{error}</p>
        )}
      </div>
    </CardLayout>
  );
}
