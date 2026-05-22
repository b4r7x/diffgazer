import { useRef, useState, type KeyboardEvent } from "react";
import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import { getErrorMessage } from "@diffgazer/core/errors";
import { focusNavigationItem } from "@diffgazer/keys";
import { CardLayout } from "@/components/ui/card-layout";
import { toast } from "@diffgazer/ui/components/toast";
import { Button } from "@diffgazer/ui/components/button";
import { TrustPermissionsContent } from "@/components/shared/trust-permissions-content";
import { useSaveTrust } from "@diffgazer/core/api/hooks";

export interface TrustPanelProps {
  directory: string;
  projectId: string;
}

const DEFAULT_CAPABILITIES: TrustCapabilities = {
  readFiles: true,
  runCommands: false,
};

function getActionLabel(isLoading: boolean, hasRepoAccess: boolean): string {
  if (isLoading) return "Saving...";
  if (hasRepoAccess) return "Trust & Continue";
  return "Continue Without Trust";
}

export function TrustPanel({
  directory,
  projectId,
}: TrustPanelProps) {
  const saveTrust = useSaveTrust();
  const isLoading = saveTrust.isPending;
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(DEFAULT_CAPABILITIES);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const handleListBoundaryNext = () => buttonRef.current?.focus();
  const hasRepoAccess = capabilities.readFiles;

  const handleButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowUp" || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    const group = listContainerRef.current?.querySelector<HTMLElement>('[data-diffgazer-selectable-owner="checkbox"]');
    if (!group) return;
    focusNavigationItem(group, {
      type: "checkbox",
      value: "readFiles",
      fallback: "last",
      preventScroll: true,
    });
  };

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

  const actionLabel = getActionLabel(isLoading, hasRepoAccess);

  return (
    <CardLayout
      title="Trust This Repository?"
      subtitle="Diffgazer needs permissions to review your code"
      footer={
        <Button ref={buttonRef} variant="success" size="sm" onClick={handleTrust} disabled={isLoading} onKeyDown={handleButtonKeyDown}>
          {actionLabel}
        </Button>
      }
    >
      <div ref={listContainerRef}>
        <TrustPermissionsContent
          directory={directory}
          value={capabilities}
          onChange={setCapabilities}
          showActions={false}
          onListBoundaryNext={handleListBoundaryNext}
          autoFocusList
        />
      </div>
    </CardLayout>
  );
}
