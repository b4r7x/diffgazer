import { useState } from "react";
import type { SecretsStorage } from "@/types/config";
import { Button, RadioGroup, RadioGroupItem, Callout } from "@/components/ui";
import { WizardLayout } from "./wizard-layout";

export interface StorageWizardProps {
  initialValue?: SecretsStorage | null;
  onComplete: (choice: SecretsStorage) => void;
  onSkip?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function StorageWizard({
  initialValue,
  onComplete,
  onSkip,
  isLoading = false,
  error,
}: StorageWizardProps) {
  const [choice, setChoice] = useState<SecretsStorage | null>(initialValue ?? null);

  const handleSubmit = () => {
    if (choice) {
      onComplete(choice);
    }
  };

  return (
    <WizardLayout
      title="Configure Secrets Storage"
      subtitle="Choose where API keys and sensitive data should be stored."
      footer={
        <>
          {onSkip && (
            <Button variant="ghost" onClick={onSkip} disabled={isLoading}>
              Decide later
            </Button>
          )}
          <Button
            variant="success"
            onClick={handleSubmit}
            disabled={isLoading || !choice}
          >
            {isLoading ? "Saving..." : "Continue"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <RadioGroup
          value={choice ?? undefined}
          onValueChange={(v) => setChoice(v as SecretsStorage)}
          className="space-y-2"
        >
          <RadioGroupItem
            value="file"
            label="File Storage (Local)"
            description="Store secrets in an encrypted file on your filesystem. Simple and portable."
          />
          <RadioGroupItem
            value="keyring"
            label="System Keyring"
            description="Use your operating system's secure keychain. Better security, system-integrated."
          />
        </RadioGroup>

        <Callout variant="info">
          You can change this setting later from the Settings menu.
        </Callout>

        {error && (
          <p className="text-tui-red text-sm">{error}</p>
        )}
      </div>
    </WizardLayout>
  );
}
