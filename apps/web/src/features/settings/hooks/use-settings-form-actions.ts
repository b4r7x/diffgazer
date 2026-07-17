import { useSaveSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { useKey } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useState } from "react";
import { useSettingsFormFooter } from "./use-settings-form-footer";

interface UseSettingsFormActionsOptions {
  canSave: boolean;
  getSettingsPayload: () => Partial<SettingsConfig>;
  contentShortcuts: Shortcut[];
  focusFallbackRef?: RefObject<HTMLElement | null>;
}

export function useSettingsFormActions({
  canSave: saveAvailable,
  getSettingsPayload,
  contentShortcuts,
  focusFallbackRef,
}: UseSettingsFormActionsOptions) {
  const navigate = useNavigate();
  const saveSettings = useSaveSettings();
  const [error, setError] = useState<string | null>(null);
  const isSaving = saveSettings.isPending;
  const canSave = saveAvailable && !isSaving;

  const onCancel = () => navigate({ to: "/settings" });
  const onSave = async (): Promise<void> => {
    if (!canSave) return;

    setError(null);
    try {
      await saveSettings.mutateAsync(getSettingsPayload());
      navigate({ to: "/settings" });
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save settings"));
    }
  };

  useKey("Escape", onCancel, { enabled: !isSaving });

  const footer = useSettingsFormFooter({
    disabledActions: [isSaving, !canSave],
    canSave,
    onCancel,
    onSave,
    contentShortcuts,
    rightShortcuts: [BACK_SHORTCUT],
    focusFallbackRef,
  });

  return { canSave, error, footer, isSaving, onCancel, onSave };
}
