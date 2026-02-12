import { useKey, useScope } from "keyscope";

type FocusZone = "list" | "buttons";

interface UseTrustFormKeyboardOptions {
  enabled?: boolean;
  focusZone: FocusZone;
  buttonIndex: number;
  buttonsCount: number;
  onButtonIndexChange: (index: number) => void;
  onFocusZoneChange: (zone: FocusZone) => void;
  onSave?: () => void;
  onRevoke?: () => void;
}

export function useTrustFormKeyboard({
  enabled = true,
  focusZone,
  buttonIndex,
  buttonsCount,
  onButtonIndexChange,
  onFocusZoneChange,
  onSave,
  onRevoke,
}: UseTrustFormKeyboardOptions) {
  useScope("trust-form");

  const isButtonsZone = focusZone === "buttons" && enabled;

  const handleAction = () => {
    if (buttonIndex === 0 && onSave) onSave();
    else if (buttonIndex === 1 && onRevoke) onRevoke();
  };

  useKey({
    ArrowUp: () => {
      onFocusZoneChange("list");
      onButtonIndexChange(0);
    },
    ArrowLeft: () => onButtonIndexChange(Math.max(0, buttonIndex - 1)),
    ArrowRight: () => onButtonIndexChange(Math.min(buttonsCount - 1, buttonIndex + 1)),
    " ": handleAction,
  }, { enabled: isButtonsZone, preventDefault: true });

  useKey("Enter", handleAction, { enabled: isButtonsZone });
}
