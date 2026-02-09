import { useKey, useScope } from "@diffgazer/keyboard";

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

  useKey("ArrowUp", () => {
    onFocusZoneChange("list");
    onButtonIndexChange(0);
  }, { enabled: isButtonsZone });

  useKey("ArrowDown", () => {}, { enabled: isButtonsZone });

  useKey("ArrowLeft", () => onButtonIndexChange(Math.max(0, buttonIndex - 1)), {
    enabled: isButtonsZone,
  });

  useKey(
    "ArrowRight",
    () => onButtonIndexChange(Math.min(buttonsCount - 1, buttonIndex + 1)),
    { enabled: isButtonsZone }
  );

  useKey(
    "Enter",
    () => {
      if (buttonIndex === 0 && onSave) onSave();
      else if (buttonIndex === 1 && onRevoke) onRevoke();
    },
    { enabled: isButtonsZone }
  );

  useKey(
    " ",
    () => {
      if (buttonIndex === 0 && onSave) onSave();
      else if (buttonIndex === 1 && onRevoke) onRevoke();
    },
    { enabled: isButtonsZone }
  );
}
