import { useState } from "react";
import { useInput } from "ink";

type SettingsZone = "list" | "buttons";

interface UseSettingsZoneOptions {
  buttonCount: number;
  disabled?: boolean;
}

interface SettingsZoneResult {
  zone: SettingsZone;
  buttonIndex: number;
  isListActive: boolean;
  isButtonActive: (index: number) => boolean;
}

export function useSettingsZone({
  buttonCount,
  disabled = false,
}: UseSettingsZoneOptions): SettingsZoneResult {
  const [zone, setZone] = useState<SettingsZone>("list");
  const [buttonIndex, setButtonIndex] = useState(0);

  useInput(
    (_input, key) => {
      if (key.tab) {
        setZone((z) => (z === "list" ? "buttons" : "list"));
        return;
      }

      if (zone === "buttons") {
        if (key.leftArrow) {
          setButtonIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (key.rightArrow) {
          setButtonIndex((i) => Math.min(buttonCount - 1, i + 1));
          return;
        }
        if (key.upArrow) {
          setZone("list");
          return;
        }
      }
    },
    { isActive: !disabled },
  );

  return {
    zone,
    buttonIndex,
    isListActive: zone === "list" && !disabled,
    isButtonActive: (index: number) =>
      zone === "buttons" && buttonIndex === index && !disabled,
  };
}
