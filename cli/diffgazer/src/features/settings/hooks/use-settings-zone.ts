import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { useInput } from "ink";
import { useState } from "react";
import { getFirstEnabledAction, useActionRow } from "../../../hooks/use-action-row";

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
  enterButtons: () => void;
}

interface SettingsFooterOptions {
  zone: SettingsZone;
  listShortcuts: Shortcut[];
  buttonActionLabel: string;
  buttonActionDisabled?: boolean;
}

export function getSettingsFooter({
  zone,
  listShortcuts,
  buttonActionLabel,
  buttonActionDisabled = false,
}: SettingsFooterOptions): { shortcuts: Shortcut[]; rightShortcuts: Shortcut[] } {
  const zoneShortcuts =
    zone === "buttons"
      ? [
          { key: "←/→", label: "Move Action" },
          { key: "Enter", label: buttonActionLabel, disabled: buttonActionDisabled },
        ]
      : listShortcuts;

  return {
    shortcuts: [...zoneShortcuts, { key: "Tab", label: "Switch Zone" }],
    rightShortcuts: [BACK_SHORTCUT],
  };
}

export function useSettingsZone({
  buttonCount,
  disabled = false,
  initialZone = "list",
  disabledButtons,
  hasList = true,
}: UseSettingsZoneOptions): SettingsZoneResult {
  const [zone, setZone] = useState<SettingsZone>(hasList ? initialZone : "buttons");
  const effectiveZone = hasList ? zone : "buttons";
  const disabledActions = Array.from({ length: buttonCount }, (_, index) =>
    Boolean(disabledButtons?.includes(index)),
  );
  const actionRow = useActionRow({
    actionCount: buttonCount,
    disabledActions,
    onAction: () => {},
    isActive: effectiveZone === "buttons" && !disabled,
    verticalNavigation: hasList,
    onExitUp: hasList ? () => setZone("list") : undefined,
  });

  function enterButtons() {
    actionRow.reset(getFirstEnabledAction(buttonCount, disabledActions));
    setZone("buttons");
  }

  useInput(
    (_input, key) => {
      if (key.tab) {
        if (!hasList) {
          setZone("buttons");
          return;
        }
        const next = effectiveZone === "list" ? "buttons" : "list";
        if (next === "buttons") {
          actionRow.reset(getFirstEnabledAction(buttonCount, disabledActions));
        }
        setZone(next);
        return;
      }
    },
    { isActive: !disabled },
  );

  return {
    zone: effectiveZone,
    buttonIndex: actionRow.activeIndex,
    isListActive: hasList && effectiveZone === "list" && !disabled,
    isButtonActive: (index: number) =>
      effectiveZone === "buttons" &&
      actionRow.activeIndex === index &&
      !disabled &&
      !disabledButtons?.includes(index),
    enterButtons,
  };
}
