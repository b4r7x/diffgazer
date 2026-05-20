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

  return (
    <CardLayout
      title="Configure Secrets Storage"
      subtitle="Choose where API keys and sensitive data should be stored."
      footer={
        <Button
          variant="success"
          onClick={() => onComplete(choice)}
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
          autoFocusList={!isLoading}
        />

        <Callout tone="info">
          <Callout.Content>You can change this setting later from the Settings menu.</Callout.Content>
        </Callout>

        {error && (
          <p className="text-tui-red text-sm">{error}</p>
        )}
      </div>
    </CardLayout>
  );
}
