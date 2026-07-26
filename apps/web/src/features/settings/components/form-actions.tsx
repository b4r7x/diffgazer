import type { UseActionRowNavigationReturn } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";

interface SettingsFormActionsProps {
  footer: UseActionRowNavigationReturn;
  isSaving: boolean;
  canSave: boolean;
  onCancel: () => void;
  onSave: () => void;
}

// The shared Cancel/Save button pair for the settings detail footers. Callers
// wrap it as their layout needs.
//
// Both buttons are bracketed so every settings child speaks the same terminal
// action grammar, and Save is the single filled `primary` voice the dialogs
// already use for Confirm.
export function SettingsFormActions({
  footer,
  isSaving,
  canSave,
  onCancel,
  onSave,
}: SettingsFormActionsProps) {
  return (
    <>
      <Button
        {...footer.getActionProps(0)}
        variant="ghost"
        bracket
        onClick={onCancel}
        disabled={isSaving}
        highlighted={footer.inActions && footer.focusedIndex === 0 && !isSaving}
      >
        Cancel
      </Button>
      <Button
        {...footer.getActionProps(1)}
        variant="primary"
        bracket
        onClick={onSave}
        disabled={!canSave}
        highlighted={footer.inActions && footer.focusedIndex === 1 && canSave}
      >
        {isSaving ? "Saving..." : "Save"}
      </Button>
    </>
  );
}
