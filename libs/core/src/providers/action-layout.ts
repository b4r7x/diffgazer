import { canSelectConfiguration } from "../schemas/config/readiness.js";
import type { Shortcut } from "../schemas/presentation/shortcuts.js";
import {
  CHANGE_MODEL_LABEL,
  MORE_ACTIONS_LABEL,
  PROVIDER_ACTION_LABELS,
  type ProviderActionTask,
} from "./detail-presentation.js";
import type { ProviderListRow } from "./list.js";

/** Identifies which handler a rendered provider action runs. */
export type ProviderActionId =
  | "dispatch"
  | "selectConfiguration"
  | "setup"
  | "verify"
  | "selectModel"
  | "delete";

interface ProviderControlBase {
  readonly label: string;
  /** Set when the control is listed but cannot run; also the announced reason. */
  readonly disabledReason?: string;
}

export interface ProviderAction extends ProviderControlBase {
  readonly id: ProviderActionId;
  /**
   * The task behind the action. Two actions carrying the same task are the same
   * button, so the layout never shows a task twice, and the accelerators find
   * their action by it wherever the state placed it.
   */
  readonly task: ProviderActionTask;
}

/** A control in the details action row: an action, or the trigger of the More menu. */
export type ProviderRowControl = ProviderAction | (ProviderControlBase & { readonly id: "more" });

/**
 * The details action row, derived once here so the web row and the TUI row
 * cannot drift: one state-driven primary, at most one secondary, and a More
 * menu whose entries are constant — an entry the row already shows is left
 * out, an entry the state cannot run stays listed, disabled, with its reason.
 * `delete` is always the last menu entry.
 */
export interface ProviderActionLayout {
  /** True when the row is the configuration reviews currently run with. */
  readonly active: boolean;
  /** Absent for the active configuration: it has nothing left to select. */
  readonly primary: ProviderAction | null;
  readonly secondary: ProviderAction | null;
  readonly overflow: readonly ProviderAction[];
}

export type ProviderActionHotkey = "m" | "e" | "v" | "d";

interface ProviderActionHotkeyBinding {
  readonly key: ProviderActionHotkey;
  /** Footer wording; the menu and the help table name the full action. */
  readonly label: string;
  /** The tasks the key runs, so it reaches its action wherever the state placed it. */
  readonly tasks: readonly ProviderActionTask[];
}

/**
 * Single-letter accelerators, shared by both surfaces' key handlers, footers,
 * menus and the help table. `e` opens setup whether the row offers its first
 * configuration or an update.
 */
export const PROVIDER_ACTION_HOTKEYS: readonly ProviderActionHotkeyBinding[] = [
  { key: "m", label: "Model", tasks: ["select"] },
  { key: "e", label: "Edit", tasks: ["update", "create"] },
  { key: "v", label: "Verify", tasks: ["test"] },
  { key: "d", label: "Delete", tasks: ["delete"] },
];

const EMPTY_LAYOUT: ProviderActionLayout = {
  active: false,
  primary: null,
  secondary: null,
  overflow: [],
};

const CONFIGURE_FIRST_REASON = "Configure this provider first";
const UNRECOGNIZED_REASON = "Only removal is available";

const MORE_CONTROL: ProviderRowControl = { id: "more", label: MORE_ACTIONS_LABEL };

function getDispatchAction(row: ProviderListRow): ProviderAction {
  if (!canSelectConfiguration(row.readiness.status)) {
    const task = row.readiness.action;
    return { id: "dispatch", task, label: PROVIDER_ACTION_LABELS[task] };
  }
  const selectConfiguration: ProviderAction = {
    id: "selectConfiguration",
    task: "select-configuration",
    label: PROVIDER_ACTION_LABELS["select-configuration"],
  };
  if (!row.actions.includes("select")) {
    return { ...selectConfiguration, disabledReason: "Selection is not available" };
  }
  return selectConfiguration;
}

function unavailableReason(row: ProviderListRow, reason: string): string {
  return row.configuration ? reason : CONFIGURE_FIRST_REASON;
}

function getSetupAction(row: ProviderListRow): ProviderAction {
  const setup: ProviderAction = {
    id: "setup",
    task: "update",
    label: PROVIDER_ACTION_LABELS.update,
  };
  if (row.actions.includes("update")) return setup;
  return { ...setup, disabledReason: unavailableReason(row, "No setup action is available") };
}

/**
 * Verify is optional beside selection; before that, the readiness action leads
 * (it is the primary when it is Verify itself), so the menu entry names it.
 */
function getVerifyAction(row: ProviderListRow): ProviderAction {
  const verify: ProviderAction = { id: "verify", task: "test", label: PROVIDER_ACTION_LABELS.test };
  if (!row.actions.includes("test")) {
    return { ...verify, disabledReason: unavailableReason(row, "Verification is not available") };
  }
  if (canSelectConfiguration(row.readiness.status)) return verify;
  return { ...verify, disabledReason: `${PROVIDER_ACTION_LABELS[row.readiness.action]} first` };
}

function getModelAction(row: ProviderListRow): ProviderAction {
  const model: ProviderAction = {
    id: "selectModel",
    task: "select",
    label: row.configuration?.selectedModelId ? CHANGE_MODEL_LABEL : PROVIDER_ACTION_LABELS.select,
  };
  if (row.actions.includes("select")) return model;
  return { ...model, disabledReason: unavailableReason(row, "Model selection is not available") };
}

function getDeleteAction(row: ProviderListRow): ProviderAction {
  const remove: ProviderAction = {
    id: "delete",
    task: "delete",
    label: PROVIDER_ACTION_LABELS.delete,
  };
  if (row.actions.includes("delete")) return remove;
  return { ...remove, disabledReason: unavailableReason(row, "Deletion is not available") };
}

export function getProviderActionLayout(
  row: ProviderListRow | null,
  activeConfigurationId: string | null,
): ProviderActionLayout {
  if (!row) return EMPTY_LAYOUT;

  const active =
    row.configuration !== null && row.configuration.configurationId === activeConfigurationId;
  const dispatch = getDispatchAction(row);
  // The active configuration has nothing left to select, but a readiness fix
  // it needs still leads.
  const primary = active && dispatch.task === "select-configuration" ? null : dispatch;

  const model = getModelAction(row);
  const setup = getSetupAction(row);
  const secondary =
    [model, setup].find((action) => !action.disabledReason && action.task !== primary?.task) ??
    null;

  const overflow = [setup, getVerifyAction(row), model, getDeleteAction(row)].filter(
    (action) => action.task !== primary?.task && action !== secondary,
  );

  return { active, primary, secondary, overflow };
}

/**
 * A record this build could not decode: nothing can be offered for a record
 * nothing can describe, so the menu keeps its shape with every entry but
 * removal disabled.
 */
export function getUnrecognizedConfigurationActionLayout(): ProviderActionLayout {
  const unavailable = { disabledReason: UNRECOGNIZED_REASON } as const;
  return {
    active: false,
    primary: null,
    secondary: null,
    overflow: [
      { id: "setup", task: "update", label: PROVIDER_ACTION_LABELS.update, ...unavailable },
      { id: "verify", task: "test", label: PROVIDER_ACTION_LABELS.test, ...unavailable },
      { id: "selectModel", task: "select", label: PROVIDER_ACTION_LABELS.select, ...unavailable },
      { id: "delete", task: "delete", label: PROVIDER_ACTION_LABELS.delete },
    ],
  };
}

/** The rendered row, in order: primary, secondary, then the More trigger. */
export function getProviderRowControls(layout: ProviderActionLayout): ProviderRowControl[] {
  const controls: ProviderRowControl[] = [];
  if (layout.primary) controls.push(layout.primary);
  if (layout.secondary) controls.push(layout.secondary);
  if (layout.overflow.length > 0) controls.push(MORE_CONTROL);
  return controls;
}

/**
 * The one disabled rule for a rendered control, shared by the renderers and the
 * web keyboard row's focus custody: the row only repairs the browser's
 * disable-blur when it sees the focused index as disabled the way the DOM does.
 */
export function isProviderControlDisabled(
  control: ProviderRowControl,
  isPending: boolean,
): boolean {
  return isPending || Boolean(control.disabledReason);
}

/**
 * The tasks that send repository content to a provider, or store the
 * credentials to do so; the surfaces run them behind the provider consent.
 * The model picker, inspection and removal send nothing and run at once.
 */
const CONSENT_GATED_TASKS: ReadonlySet<ProviderActionTask> = new Set([
  "select-configuration",
  "create",
  "update",
  "test",
]);

export function isConsentGatedProviderAction(action: ProviderAction): boolean {
  return CONSENT_GATED_TASKS.has(action.task);
}

/** The action a key runs right now, wherever the state placed it; null when it cannot run. */
export function findProviderHotkeyAction(
  layout: ProviderActionLayout,
  key: ProviderActionHotkey,
): ProviderAction | null {
  const tasks = PROVIDER_ACTION_HOTKEYS.find((hotkey) => hotkey.key === key)?.tasks ?? [];
  return (
    [layout.primary, layout.secondary, ...layout.overflow].find(
      (action): action is ProviderAction =>
        action !== null && !action.disabledReason && tasks.includes(action.task),
    ) ?? null
  );
}

/** The key a menu entry answers to, so the menu teaches it. */
export function getProviderActionHotkey(action: ProviderAction): ProviderActionHotkey | undefined {
  return PROVIDER_ACTION_HOTKEYS.find((hotkey) => hotkey.tasks.includes(action.task))?.key;
}

/** Footer shortcuts for the keys the layout can run right now. */
export function getProviderActionShortcuts(layout: ProviderActionLayout): Shortcut[] {
  return PROVIDER_ACTION_HOTKEYS.filter(
    ({ key }) => findProviderHotkeyAction(layout, key) !== null,
  ).map(({ key, label }) => ({ key, label }));
}
