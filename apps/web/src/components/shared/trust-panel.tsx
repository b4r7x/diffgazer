import { useSaveTrust } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import {
  DEFAULT_TRUST_PROMPT_CAPABILITIES,
  getTrustButtonLabel,
} from "@diffgazer/core/schemas/config";
import { TRUST_FOOTER_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { focusNavigationItem } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { toast } from "@diffgazer/ui/components/toast";
import { type KeyboardEvent, useRef, useState } from "react";
import { TrustPermissionsContent } from "@/components/shared/trust-permissions-content";
import { CardLayout } from "@/components/ui/card-layout";

export interface TrustPanelProps {
  directory: string;
}

export const TRUST_PANEL_FOOTER_SHORTCUTS = TRUST_FOOTER_SHORTCUTS.slice(0, 2);

export function TrustPanel({ directory }: TrustPanelProps) {
  usePageFooter({ shortcuts: TRUST_PANEL_FOOTER_SHORTCUTS });
  const saveTrust = useSaveTrust();
  const isLoading = saveTrust.isPending;
  const [capabilities, setCapabilities] = useState<TrustCapabilities>(
    DEFAULT_TRUST_PROMPT_CAPABILITIES,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const handleListBoundaryNext = () => buttonRef.current?.focus();
  const hasRepoAccess = capabilities.readFiles;

  const handleButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowUp" || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    const group = listContainerRef.current?.querySelector<HTMLElement>(
      '[data-diffgazer-selectable-owner="checkbox"]',
    );
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
      await saveTrust.mutateAsync({ capabilities, trustMode: "persistent" });
    } catch (error) {
      toast.error("Failed to save trust settings", {
        message: getErrorMessage(error, "Unknown error"),
      });
    }
  }

  const actionLabel = getTrustButtonLabel(isLoading, hasRepoAccess);

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
          disabled={isLoading}
          onKeyDown={handleButtonKeyDown}
        >
          {actionLabel}
        </Button>
      }
    >
      <div ref={listContainerRef}>
        <TrustPermissionsContent
          directory={directory}
          value={capabilities}
          onChange={setCapabilities}
          isLoading={isLoading}
          showActions={false}
          onListBoundaryNext={handleListBoundaryNext}
          autoFocusList
        />
      </div>
    </CardLayout>
  );
}
