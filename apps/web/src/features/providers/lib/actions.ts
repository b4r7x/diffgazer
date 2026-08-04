import type { ProviderListRow } from "@diffgazer/core/providers";
import type { ClientConfigurationActionName } from "@diffgazer/core/schemas/config";

/** Identifies which handler a rendered provider action runs. */
export type ProviderActionId = "dispatch" | "setup" | "selectModel" | "delete";

/**
 * The task an action performs. Two actions carrying the same task are the same
 * button, whatever their copy says, so this — never the label — drives de-duplication.
 * "select-configuration" is the only task with no configuration action behind it:
 * it picks an already-ready configuration for the review.
 */
export type ProviderActionTask = ClientConfigurationActionName | "select-configuration";

/** Visual weight of a provider action, mapped 1:1 onto Button variants. */
export type ProviderActionIntent = "primary" | "outline" | "link" | "destructive";

export interface ProviderAction {
  readonly id: ProviderActionId;
  readonly task: ProviderActionTask;
  readonly label: string;
  readonly intent: ProviderActionIntent;
  /** Set when the action is listed but cannot run; also the announced reason. */
  readonly disabledReason?: string;
}

/**
 * The one disabled rule for a rendered provider action, shared by the renderer, the keyboard
 * row's focus custody, and the activation guard. They must agree: the row only repairs the
 * browser's disable-blur when it sees the focused index as disabled the way the DOM does.
 */
export function isProviderActionDisabled(action: ProviderAction, isPending: boolean): boolean {
  return isPending || Boolean(action.disabledReason);
}

const ACTION_LABELS = {
  create: "Create configuration",
  inspect: "Inspect configuration",
  select: "Select model",
  test: "Test readiness",
  update: "Update configuration",
  delete: "Delete configuration",
  "select-configuration": "Select configuration",
} as const satisfies Record<ProviderActionTask, string>;

function getDispatchAction(row: ProviderListRow): ProviderAction {
  if (!row.readiness.ready) {
    const task = row.readiness.action;
    return { id: "dispatch", task, label: ACTION_LABELS[task], intent: "primary" };
  }
  const selectConfiguration: ProviderAction = {
    id: "dispatch",
    task: "select-configuration",
    label: ACTION_LABELS["select-configuration"],
    intent: "primary",
  };
  if (!row.actions.includes("select")) {
    return { ...selectConfiguration, disabledReason: "Selection is not available" };
  }
  return selectConfiguration;
}

function getSetupTask(row: ProviderListRow): "create" | "update" | null {
  if (row.actions.includes("create")) return "create";
  if (row.actions.includes("update")) return "update";
  return null;
}

/**
 * The single source of truth for a provider row's action row.
 *
 * The list is de-duplicated by construction: the readiness-driven dispatch task comes first and
 * every other action is dropped when it would restate that same task. Two independently derived
 * lists (one for the renderer, one for keyboard navigation) is what produced duplicate buttons
 * and duplicate React keys, so both paths derive from here.
 */
export function getProviderActions(row: ProviderListRow | null): ProviderAction[] {
  if (!row) return [];

  const dispatch = getDispatchAction(row);
  const actions: ProviderAction[] = [dispatch];

  const setupTask = getSetupTask(row);
  if (setupTask !== null && setupTask !== dispatch.task) {
    actions.push({
      id: "setup",
      task: setupTask,
      label: ACTION_LABELS[setupTask],
      intent: "outline",
    });
  }

  if (row.actions.includes("select") && dispatch.task !== "select") {
    actions.push({
      id: "selectModel",
      task: "select",
      label: ACTION_LABELS.select,
      intent: "link",
    });
  }

  if (row.actions.includes("delete")) {
    actions.push({
      id: "delete",
      task: "delete",
      label: ACTION_LABELS.delete,
      intent: "destructive",
    });
  }

  return actions;
}
