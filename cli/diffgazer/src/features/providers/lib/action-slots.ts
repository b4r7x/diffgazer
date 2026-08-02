import type { ProviderListRow } from "@diffgazer/core/providers";
import type { ClientConfigurationActionName } from "@diffgazer/core/schemas/config";

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
