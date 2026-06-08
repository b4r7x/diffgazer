import { useInput } from "ink";
import { useEffect, useState } from "react";

type SettingsZone = "list" | "buttons";

interface UseSettingsZoneOptions {
  buttonCount: number;
  disabled?: boolean;
  initialZone?: SettingsZone;
  disabledButtons?: number[];
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
}: UseSettingsZoneOptions): SettingsZoneResult {
  const [zone, setZone] = useState<SettingsZone>(initialZone);
  const [buttonIndex, setButtonIndex] = useState(() =>
    findFirstEnabledButton(buttonCount, disabledButtons),
  );

  useEffect(() => {
    setButtonIndex((current) => {
      if (!disabledButtons?.includes(current)) return current;
      return findFirstEnabledButton(buttonCount, disabledButtons);
    });
  }, [buttonCount, disabledButtons]);

  useInput(
    (_input, key) => {
      if (key.tab) {
        setZone((current) => {
          const next = current === "list" ? "buttons" : "list";
          if (next === "buttons") {
            setButtonIndex(findFirstEnabledButton(buttonCount, disabledButtons));
          }
          return next;
        });
        return;
      }

      if (zone === "buttons") {
        if (key.leftArrow) {
          setButtonIndex((current) =>
            findNextEnabledButton(current, -1, buttonCount, disabledButtons),
          );
          return;
        }
        if (key.rightArrow) {
          setButtonIndex((current) =>
            findNextEnabledButton(current, 1, buttonCount, disabledButtons),
          );
          return;
        }
        if (key.upArrow) {
          setZone("list");
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
      zone === "buttons" && buttonIndex === index && !disabled && !disabledButtons?.includes(index),
  };
}
