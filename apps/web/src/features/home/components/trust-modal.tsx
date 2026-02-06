import { useState } from "react";
import type { TrustCapabilities } from "@stargazer/schemas/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TrustPermissionsContent } from "@/components/shared/trust-permissions-content";
import { useTrust } from "@/hooks/use-trust";

export interface TrustModalProps {
  isOpen: boolean;
  directory: string;
  projectId: string;
}

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  runCommands: false,
};

const getActionLabel = (isSaving: boolean, hasRepoAccess: boolean): string => {
  if (isSaving) return "[ Saving... ]";
  if (!hasRepoAccess) return "[ Continue Without Trust ]";
  return "[ Trust & Continue ]";
};

export function TrustModal({
  isOpen,
  directory,
  projectId,
}: TrustModalProps) {
  const { showToast } = useToast();
  const { save, isLoading } = useTrust(projectId);
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(DEFAULT_CAPABILITIES);
  const hasRepoAccess = capabilities.readFiles;
  const actionLabel = getActionLabel(isLoading, hasRepoAccess);

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

  return (
    <Dialog open={isOpen}>
      <DialogContent key={String(isOpen)} className="max-w-lg">
        <DialogHeader className="bg-tui-selection/50">
          <DialogTitle className="text-tui-blue tracking-wide">
            Trust This Repository?
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="p-6">
          <TrustPermissionsContent
            directory={directory}
            value={capabilities}
            onChange={setCapabilities}
            showActions={false}
          />
        </DialogBody>

        <DialogFooter>
          <Button variant="success" onClick={handleTrust} disabled={isLoading}>
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
