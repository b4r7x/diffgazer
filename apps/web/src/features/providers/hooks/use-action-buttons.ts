import type { ProviderListRow } from "@diffgazer/core/providers";
import type { ClientConfigurationActionName } from "@diffgazer/core/schemas/config";
import { DECLINE, useActionRowNavigation, useKey } from "@diffgazer/keys";
import type { RefCallback } from "react";

const BUTTON_COUNT = 4;

const ACTION_LABELS = {
  create: "Create configuration",
  inspect: "Inspect configuration",
  select: "Select model",
  test: "Test readiness",
  update: "Update configuration",
  delete: "Delete configuration",
} as const satisfies Record<ClientConfigurationActionName, string>;

export interface ActionSlot {
  enabled: boolean;
  label: string;
  disabledReason?: string;
}

interface UseProvidersActionButtonsOptions {
  selectedRow: ProviderListRow | null;
  dialogOpen: boolean;
  inButtons: boolean;
  setZone: (zone: "input" | "filters" | "list" | "buttons") => void;
  focusProviderList: () => void;
  onSetup: () => void;
  onSelectModel: () => void;
  onDelete: () => void;
  onDispatchAction: (row: ProviderListRow) => void;
}

interface UseProvidersActionButtonsResult {
  buttonIndex: number;
  enterButtons: (index?: number) => void;
  getActionButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
    "aria-disabled"?: boolean;
    title?: string;
  };
  getActionSlot: (index: number) => ActionSlot;
}

function getSetupSlot(row: ProviderListRow): ActionSlot {
  if (row.product.status === "removed") {
    return {
      enabled: false,
      label: "Setup",
      disabledReason: "Removed records cannot be configured",
    };
  }
  if (row.actions.includes("create")) {
    return { enabled: true, label: "Create configuration" };
  }
  if (row.actions.includes("update")) {
    return { enabled: true, label: "Update configuration" };
  }
  return { enabled: false, label: "Setup", disabledReason: "No setup action is available" };
}

function getDeleteSlot(row: ProviderListRow): ActionSlot {
  if (!row.actions.includes("delete")) {
    return {
      enabled: false,
      label: "Delete configuration",
      disabledReason: "Deletion is not available for this record",
    };
  }
  return {
    enabled: true,
    label: row.product.status === "removed" ? "Delete removed record" : "Delete configuration",
  };
}

function getSelectModelSlot(row: ProviderListRow): ActionSlot {
  if (row.product.status === "removed" || !row.actions.includes("select")) {
    return {
      enabled: false,
      label: "Select model",
      disabledReason: "Model selection is not available",
    };
  }
  return { enabled: true, label: "Select model" };
}

function getDispatchSlot(row: ProviderListRow): ActionSlot {
  if (row.product.status === "removed") {
    return {
      enabled: false,
      label: ACTION_LABELS.inspect,
      disabledReason: "Removed records cannot be selected",
    };
  }
  if (!row.readiness.ready && row.readiness.action === "create") {
    return {
      enabled: true,
      label: ACTION_LABELS.create,
    };
  }
  if (!row.readiness.ready) {
    return {
      enabled: true,
      label: ACTION_LABELS[row.readiness.action],
    };
  }
  return {
    enabled: row.actions.includes("select"),
    label: "Select configuration",
    disabledReason: row.actions.includes("select") ? undefined : "Selection is not available",
  };
}

export function getProviderActionSlots(row: ProviderListRow | null): ActionSlot[] {
  return getActionSlots(row);
}

function getActionSlots(row: ProviderListRow | null): ActionSlot[] {
  if (!row) {
    return Array.from({ length: BUTTON_COUNT }, () => ({
      enabled: false,
      label: "Unavailable",
      disabledReason: "Select a provider first",
    }));
  }

  return [getDispatchSlot(row), getSetupSlot(row), getDeleteSlot(row), getSelectModelSlot(row)];
}

export function useProvidersActionButtons({
  selectedRow,
  dialogOpen,
  inButtons,
  setZone,
  focusProviderList,
  onSetup,
  onSelectModel,
  onDelete,
  onDispatchAction,
}: UseProvidersActionButtonsOptions): UseProvidersActionButtonsResult {
  const slots = getActionSlots(selectedRow);
  const disabledActions = slots.map((slot) => !slot.enabled);

  const handleButtonAction = (index: number) => {
    if (!selectedRow || !slots[index]?.enabled) return;
    switch (index) {
      case 0:
        onDispatchAction(selectedRow);
        break;
      case 1:
        onSetup();
        break;
      case 2:
        onDelete();
        break;
      case 3:
        onSelectModel();
        break;
    }
  };

  const actionRow = useActionRowNavigation({
    enabled: !dialogOpen && inButtons,
    actionCount: BUTTON_COUNT,
    disabledActions,
    onAction: handleButtonAction,
    onNavigationBoundaryReached: (direction) => {
      if (direction === "previous") {
        setZone("list");
        focusProviderList();
      }
    },
    wrap: false,
    defaultZone: "actions",
  });

  const enterButtons = (index: number = 0) => {
    if (!selectedRow) return;
    setZone("buttons");
    actionRow.enterActions(index);
  };

  const getActionButtonProps = (index: number) => {
    const actionProps = actionRow.getActionProps(index);
    const slot = slots[index];
    return {
      ref: actionProps.ref,
      onFocus: () => {
        setZone("buttons");
        actionProps.onFocus();
      },
      ...(slot?.enabled === false ? { "aria-disabled": true as const } : {}),
      ...(slot?.disabledReason ? { title: slot.disabledReason } : {}),
    };
  };

  const navigateButtonsVertical = (direction: 1 | -1) => {
    let next = actionRow.focusedIndex + direction;
    while (next >= 0 && next < BUTTON_COUNT) {
      if (!disabledActions[next]) {
        actionRow.enterActions(next);
        return;
      }
      next += direction;
    }
    return DECLINE;
  };

  useKey("ArrowUp", () => navigateButtonsVertical(-1), {
    enabled: !dialogOpen && inButtons,
    preventDefault: true,
  });
  useKey("ArrowDown", () => navigateButtonsVertical(1), {
    enabled: !dialogOpen && inButtons,
    preventDefault: true,
  });

  return {
    buttonIndex: actionRow.focusedIndex,
    enterButtons,
    getActionButtonProps,
    getActionSlot: (index) => slots[index] ?? { enabled: false, label: "Unavailable" },
  };
}
