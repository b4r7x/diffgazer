import { useState } from "react";
import type { TrustCapabilities } from "@diffgazer/schemas/config";
import { getErrorMessage } from "@diffgazer/core/errors";
import { CardLayout } from "@/components/ui/card-layout";
import { toast } from "diffui/components/toast";
import { Button } from "diffui/components/button";
import { TrustPermissionsContent } from "@/components/shared/trust-permissions-content";
import { useSaveTrust } from "@diffgazer/api/hooks";

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
  const saveTrust = useSaveTrust();
  const isLoading = saveTrust.isPending;
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(DEFAULT_CAPABILITIES);
  const hasRepoAccess = capabilities.readFiles;

  async function handleTrust(): Promise<void> {
    if (isLoading) return;
    try {
      await saveTrust.mutateAsync({
        projectId,
        repoRoot: directory,
        capabilities,
        trustMode: "persistent",
        trustedAt: new Date().toISOString(),
      });
    } catch (error) {
      toast.error("Failed to save trust settings", { message: getErrorMessage(error, "Unknown error") });
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
      subtitle="Diffgazer needs permissions to review your code"
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
