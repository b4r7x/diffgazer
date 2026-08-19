import type { ClientConfigurationActionName } from "../schemas/config/provider-config.js";

/** Empty-pane copy shared by the web and TUI provider detail panes. */
export const PROVIDER_DETAIL_EMPTY_LABEL = "Select a provider to view details";

/**
 * How both provider surfaces name a stored record this build could not decode.
 * The copy lives here so the two lists cannot describe the same record
 * differently, and it claims nothing beyond what the bytes allow.
 */
export const UNRECOGNIZED_CONFIGURATION_COPY = {
  label: "Unrecognized configuration",
  description: "This record could not be decoded by this version. It can only be removed.",
} as const;

/**
 * The task a provider action performs. Two actions carrying the same task are
 * the same button, whatever their copy says, so this — never the label — drives
 * de-duplication. "select-configuration" is the only task with no configuration
 * action behind it: it picks an already-ready configuration for the review.
 */
export type ProviderActionTask = ClientConfigurationActionName | "select-configuration";

/**
 * The one action vocabulary the web action row and the TUI action slots both
 * render. Each surface indexes the keys it can produce; keeping the table here
 * is what stops the same button reading differently on the two surfaces.
 */
export const PROVIDER_ACTION_LABELS = {
  create: "Configure",
  inspect: "Inspect configuration",
  select: "Select model",
  test: "Verify",
  update: "Update configuration",
  delete: "Delete configuration",
  "select-configuration": "Select configuration",
} as const satisfies Record<ProviderActionTask, string>;

/** The model action once a model is pinned; before that it reads `PROVIDER_ACTION_LABELS.select`. */
export const CHANGE_MODEL_LABEL = "Change model";

/** The trigger of the details More menu on both surfaces. */
export const MORE_ACTIONS_LABEL = "More";

/** The confirmation every configuration removal passes through, on both surfaces. */
export const DELETE_CONFIGURATION_CONFIRM = {
  title: "Delete configuration?",
  subtitle: "This cannot be undone",
  body: (name: string) => `Removes ${name} and its stored credentials from this machine.`,
} as const;
