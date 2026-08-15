import { PROVIDER_ACTION_LABELS, type ProviderListRow } from "@diffgazer/core/providers";

export interface ActionSlot {
  enabled: boolean;
  label: string;
  disabledReason?: string;
}

function getSetupTask(row: ProviderListRow): "create" | "update" | null {
  if (row.actions.includes("create")) return "create";
  if (row.actions.includes("update")) return "update";
  return null;
}

/**
 * The dispatch slot leads with whatever readiness asks for, so a setup slot
 * naming the same task would be a second live button on the same handler — the
 * duplicate the web action row already de-duplicates by task. The slot stays in
 * place, disabled, because the four positions are the keyboard grid.
 */
function getSetupSlot(row: ProviderListRow): ActionSlot {
  const task = getSetupTask(row);
  if (task === null || (!row.readiness.ready && task === row.readiness.action)) {
    return { enabled: false, label: "Setup", disabledReason: "No setup action is available" };
  }
  return { enabled: true, label: PROVIDER_ACTION_LABELS[task] };
}

function getDeleteSlot(row: ProviderListRow): ActionSlot {
  if (!row.actions.includes("delete")) {
    return {
      enabled: false,
      label: PROVIDER_ACTION_LABELS.delete,
      disabledReason: "Deletion is not available for this record",
    };
  }
  return { enabled: true, label: PROVIDER_ACTION_LABELS.delete };
}

function getSelectModelSlot(row: ProviderListRow): ActionSlot {
  if (!row.actions.includes("select")) {
    return {
      enabled: false,
      label: PROVIDER_ACTION_LABELS.select,
      disabledReason: "Model selection is not available",
    };
  }
  return { enabled: true, label: PROVIDER_ACTION_LABELS.select };
}

function getDispatchSlot(row: ProviderListRow): ActionSlot {
  if (!row.readiness.ready) {
    return {
      enabled: true,
      label: PROVIDER_ACTION_LABELS[row.readiness.action],
    };
  }
  return {
    enabled: row.actions.includes("select"),
    label: PROVIDER_ACTION_LABELS["select-configuration"],
    disabledReason: row.actions.includes("select") ? undefined : "Selection is not available",
  };
}

/**
 * A record this build could not decode fills the same four keyboard positions, so
 * the grid does not shift under the user, but only the delete position is live —
 * nothing else can be offered for a record nothing can describe.
 */
export function getUnrecognizedConfigurationActionSlots(): ActionSlot[] {
  const unavailable: ActionSlot = {
    enabled: false,
    label: "Unavailable",
    disabledReason: "This record could not be decoded, so it can only be removed",
  };
  return [
    unavailable,
    unavailable,
    { enabled: true, label: PROVIDER_ACTION_LABELS.delete },
    unavailable,
  ];
}

export function getProviderActionSlots(row: ProviderListRow | null | undefined): ActionSlot[] {
  if (!row) {
    return Array.from({ length: 4 }, () => ({
      enabled: false,
      label: "Unavailable",
      disabledReason: "Select a provider first",
    }));
  }

  return [getDispatchSlot(row), getSetupSlot(row), getDeleteSlot(row), getSelectModelSlot(row)];
}
