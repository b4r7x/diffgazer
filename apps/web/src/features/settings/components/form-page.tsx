import type { UseActionRowNavigationReturn } from "@diffgazer/keys";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CardLayout } from "@/components/layout/card";
import { SettingsFormActions } from "./form-actions";
import { renderSettingsFormPending } from "./form-pending";

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
  const pendingUI = renderSettingsFormPending(query, title, subtitle);

  if (pendingUI) return pendingUI;

  return (
    <CardLayout
      title={title}
      subtitle={subtitle}
      contentInactive={footer.inActions}
      footer={
        <SettingsFormActions
          footer={footer}
          isSaving={isSaving}
          canSave={canSave}
          onCancel={onCancel}
          onSave={onSave}
        />
      }
    >
      {children}
    </CardLayout>
  );
}
