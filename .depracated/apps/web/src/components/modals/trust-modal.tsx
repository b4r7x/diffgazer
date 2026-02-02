"use client";

import { useState, useEffect } from "react";
import type { TrustCapabilities } from "@repo/schemas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Button,
} from "@/components/ui";
import { useToast } from "@/components/layout";
import { TrustPermissionsContent } from "@/components/settings/trust-permissions-content";
import { useTrust } from "@/features/settings/hooks/use-trust";

export interface TrustModalProps {
  isOpen: boolean;
  onClose: () => void;
  directory: string;
  projectId: string;
  onTrustGranted: () => void;
}

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  readGit: true,
  runCommands: false,
};

export function TrustModal({
  isOpen,
  onClose,
  directory,
  projectId,
  onTrustGranted,
}: TrustModalProps) {
  const { showToast } = useToast();
  const { save } = useTrust(projectId);
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(DEFAULT_CAPABILITIES);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCapabilities(DEFAULT_CAPABILITIES);
    }
  }, [isOpen]);

  async function handleTrust(): Promise<void> {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await save({
        projectId,
        repoRoot: directory,
        capabilities,
        trustMode: "permanent",
      });
      onTrustGranted();
    } catch (error) {
      showToast({
        variant: "error",
        title: "Failed to save trust settings",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
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
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            [ Skip for Now ]
          </Button>
          <Button variant="success" onClick={handleTrust} disabled={isSaving}>
            {isSaving ? "[ Saving... ]" : "[ Trust & Continue ]"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
