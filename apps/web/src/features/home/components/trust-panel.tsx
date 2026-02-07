import { useState } from "react";
import type { TrustCapabilities } from "@stargazer/schemas/config";
import { CardLayout, Button, useToast } from "@stargazer/ui";
import { TrustPermissionsContent } from "@/components/shared/trust-permissions-content";
import { useTrust } from "@/hooks/use-trust";

export interface TrustPanelProps {
  directory: string;
  projectId: string;
}

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  runCommands: false,
};

export function TrustPanel({
  directory,
  projectId,
}: TrustPanelProps) {
  const { showToast } = useToast();
  const { save, isLoading } = useTrust(projectId);
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(DEFAULT_CAPABILITIES);
  const hasRepoAccess = capabilities.readFiles;

  async function handleTrust(): Promise<void> {
    if (isLoading) return;
    try {
      await save({
        projectId,
        repoRoot: directory,
        capabilities,
        trustMode: "persistent",
        trustedAt: new Date().toISOString(),
      });
    } catch (error) {
      showToast({
        variant: "error",
        title: "Failed to save trust settings",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const actionLabel = isLoading
    ? "Saving..."
    : hasRepoAccess
      ? "Trust & Continue"
      : "Continue Without Trust";

  return (
    <CardLayout
      title="Trust This Repository?"
      subtitle="Stargazer needs permissions to review your code"
      footer={
        <Button variant="success" size="sm" onClick={handleTrust} disabled={isLoading}>
          {actionLabel}
        </Button>
      }
    >
      <TrustPermissionsContent
        directory={directory}
        value={capabilities}
        onChange={setCapabilities}
        showActions={false}
      />
    </CardLayout>
  );
}
