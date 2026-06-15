import { matchQueryState } from "@diffgazer/core/api/hooks";
import type { UseActionRowNavigationReturn } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { Spinner } from "@diffgazer/ui/components/spinner";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CardLayout } from "@/components/ui/card-layout";

interface SettingsFormPageProps<T> {
  title: string;
  subtitle: string;
  query: UseQueryResult<T>;
  footer: UseActionRowNavigationReturn;
  isSaving: boolean;
  canSave: boolean;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
}

/**
 * Shared shell for the settings detail pages: it gates the settings query
 * (status/alert loading and error states), renders the page CardLayout once,
 * and wires the Cancel/Save action-row pair into the footer. Pages pass their
 * dirty/save logic and selector content.
 */
export function SettingsFormPage<T>({
  title,
  subtitle,
  query,
  footer,
  isSaving,
  canSave,
  onCancel,
  onSave,
  children,
}: SettingsFormPageProps<T>) {
  const pendingUI = matchQueryState(query, {
    loading: () => (
      <CardLayout title={title} subtitle={subtitle}>
        <Spinner className="text-muted-foreground">Loading settings...</Spinner>
      </CardLayout>
    ),
    error: (err) => (
      <CardLayout title={title} subtitle={subtitle}>
        <Callout tone="error" live className="text-sm">
          <Callout.Content>{err.message}</Callout.Content>
        </Callout>
      </CardLayout>
    ),
    success: () => null,
  });

  if (pendingUI) return pendingUI;

  return (
    <CardLayout
      title={title}
      subtitle={subtitle}
      contentInactive={footer.inActions}
      footer={
        <>
          <Button
            {...footer.getActionProps(0)}
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
            highlighted={footer.inActions && footer.focusedIndex === 0 && !isSaving}
          >
            Cancel
          </Button>
          <Button
            {...footer.getActionProps(1)}
            variant="success"
            onClick={onSave}
            disabled={!canSave}
            highlighted={footer.inActions && footer.focusedIndex === 1 && canSave}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      {children}
    </CardLayout>
  );
}
