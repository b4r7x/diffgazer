import { useSaveTrust } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import {
  DEFAULT_TRUST_PROMPT_CAPABILITIES,
  getTrustButtonLabel,
} from "@diffgazer/core/schemas/config";
import { TRUST_PERMISSION_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { hasModifierKey } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { toast } from "@diffgazer/ui/components/toast";
import { type KeyboardEvent, useRef, useState } from "react";
import { CardLayout } from "@/components/layout/card";
import {
  type TrustListFocusHandle,
  TrustPermissionsContent,
} from "@/components/shared/trust-permissions-content";

interface TrustPanelProps {
  directory: string;
}

export function TrustPanel({ directory }: TrustPanelProps) {
  usePageFooter({ shortcuts: TRUST_PERMISSION_SHORTCUTS });
  const saveTrust = useSaveTrust();
  const isLoading = saveTrust.isPending;
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(
    DEFAULT_TRUST_PROMPT_CAPABILITIES,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listFocusRef = useRef<TrustListFocusHandle>(null);
  const handleListBoundaryNext = () => buttonRef.current?.focus();
  const hasRepoAccess = capabilities.readFiles;

  // Modified arrows stay native, as every other hand-off on the screen keeps them.
  const handleButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowUp" || hasModifierKey(e)) return;
    e.preventDefault();
    listFocusRef.current?.focus();
  };

  async function handleTrust(): Promise<void> {
    if (isLoading) return;
    try {
      await saveTrust.mutateAsync({ capabilities, trustMode: "persistent" });
    } catch (error) {
      toast.error("Failed to save trust settings", {
        message: getErrorMessage(error, "Unknown error"),
      });
    }
  }

  // The Button owns the busy affordance here: it renders a spinner and pushes
  // its label sr-only while loading. Passing isLoading to the label as well
  // would swap the button's accessible name to "Saving..." on top of that, so
  // this surface keeps the label stable and lets the spinner say "busy".
  const actionLabel = getTrustButtonLabel(false, hasRepoAccess);

  return (
    <CardLayout
      title="Trust This Repository?"
      subtitle="Diffgazer needs permissions to review your code"
      footer={
        <Button
          ref={buttonRef}
          variant="success"
          size="sm"
          onClick={handleTrust}
          loading={isLoading}
          onKeyDown={handleButtonKeyDown}
        >
          {actionLabel}
        </Button>
      }
    >
      <TrustPermissionsContent
        directory={directory}
        value={capabilities}
        onChange={setCapabilities}
        isLoading={isLoading}
        showActions={false}
        onListBoundaryNext={handleListBoundaryNext}
        listFocusRef={listFocusRef}
        autoFocusList
      />
    </CardLayout>
  );
}
