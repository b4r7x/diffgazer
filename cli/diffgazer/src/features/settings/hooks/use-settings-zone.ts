import { useInput } from "ink";
import { useState } from "react";

type SettingsZone = "list" | "buttons";

interface UseSettingsZoneOptions {
  buttonCount: number;
  disabled?: boolean;
  initialZone?: SettingsZone;
  disabledButtons?: number[];
  hasList?: boolean;
}

interface SettingsZoneResult {
  zone: SettingsZone;
  buttonIndex: number;
  isListActive: boolean;
  isButtonActive: (index: number) => boolean;
}

function findNextEnabledButton(
  current: number,
  direction: 1 | -1,
  buttonCount: number,
  disabledButtons: number[] | undefined,
): number {
  let next = current;
  for (let step = 0; step < buttonCount; step += 1) {
    next += direction;
    if (next < 0 || next >= buttonCount) {
      return current;
    }
    if (!disabledButtons?.includes(next)) {
      return next;
    }
  }
  return current;
}

function findFirstEnabledButton(
  buttonCount: number,
  disabledButtons: number[] | undefined,
): number {
  for (let index = 0; index < buttonCount; index += 1) {
    if (!disabledButtons?.includes(index)) {
      return index;
    }
  }
  return 0;
}

export function useSettingsZone({
  buttonCount,
  disabled = false,
  initialZone = "list",
  disabledButtons,
  hasList = true,
}: UseSettingsZoneOptions): SettingsZoneResult {
  const [zone, setZone] = useState<SettingsZone>(hasList ? initialZone : "buttons");
  const [buttonIndex, setButtonIndex] = useState(() =>
    findFirstEnabledButton(buttonCount, disabledButtons),
  );
  const effectiveZone = hasList ? zone : "buttons";

  // Derive the effective button index during render so a disabled button never
  // stays focused when disabledButtons changes (no state-sync effect).
  const effectiveButtonIndex = disabledButtons?.includes(buttonIndex)
    ? findFirstEnabledButton(buttonCount, disabledButtons)
    : buttonIndex;

  useInput(
    (_input, key) => {
      if (key.tab) {
        if (!hasList) {
          setZone("buttons");
          return;
        }
        const next = effectiveZone === "list" ? "buttons" : "list";
        if (next === "buttons") {
          setButtonIndex(findFirstEnabledButton(buttonCount, disabledButtons));
        }
        setZone(next);
        return;
      }

      if (effectiveZone === "buttons") {
        if (key.leftArrow) {
          setButtonIndex(
            findNextEnabledButton(effectiveButtonIndex, -1, buttonCount, disabledButtons),
          );
          return;
        }
        if (key.rightArrow) {
          setButtonIndex(
            findNextEnabledButton(effectiveButtonIndex, 1, buttonCount, disabledButtons),
          );
          return;
        }
        if (key.upArrow) {
          if (hasList) setZone("list");
        }
      }
    },
    { isActive: !disabled },
  );

  return {
    zone: effectiveZone,
    buttonIndex: effectiveButtonIndex,
    isListActive: hasList && effectiveZone === "list" && !disabled,
    isButtonActive: (index: number) =>
      effectiveZone === "buttons" &&
      effectiveButtonIndex === index &&
      !disabled &&
      !disabledButtons?.includes(index),
  };
}
