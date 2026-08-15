import { useRef, useState } from "react";
import { getErrorMessage } from "../errors.js";
import { useSubmitGuard } from "../forms.js";
import type {
  ClientConfigurationInput,
  ConfigurationId,
  ConfigurationRevision,
  ExactModelId,
  ReadinessAcknowledgement,
} from "../schemas/config/index.js";
import { findProviderById, getProviderRowId, type ProviderListRow } from "./list.js";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;

export interface SetupDialogOwner {
  readonly kind: "setup";
  readonly id: number;
  readonly rowId: string;
}

export interface ModelDialogOwner {
  readonly kind: "model";
  readonly id: number;
  readonly rowId: string;
  readonly configurationId: ConfigurationId;
}

export type ProviderDialogOwner = SetupDialogOwner | ModelDialogOwner;

export const PROVIDER_MANAGEMENT_ACTIONS = [
  "create",
  "update",
  "delete",
  "inspect",
  "test",
  "select",
  "select-model",
] as const;
export type ProviderManagementAction = (typeof PROVIDER_MANAGEMENT_ACTIONS)[number];

/**
 * The action/payload pairings the handlers below can actually emit: only the
 * two model actions carry a model, and only `select` starts from a row the
 * caller already holds. Encoding that here keeps surfaces from masking an
 * impossible combination with a fallback.
 */
export type ProviderManagementEvent =
  | {
      readonly action: Exclude<ProviderManagementAction, "select" | "select-model">;
      readonly row: ProviderListRow | null;
      readonly modelId: null;
    }
  | { readonly action: "select"; readonly row: ProviderListRow; readonly modelId: ExactModelId }
  | {
      readonly action: "select-model";
      readonly row: ProviderListRow | null;
      readonly modelId: ExactModelId;
    };

export type ProviderManagementFailure = ProviderManagementEvent & {
  readonly message: string;
};

/**
 * How a surface reports outcomes. Web raises toasts, the TUI writes a footer
 * status; neither copy decision belongs to this hook, so it emits the semantic
 * action plus the affected row and lets the surface phrase it.
 */
export interface ProviderManagementNotifier {
  readonly onSucceeded?: (event: ProviderManagementEvent) => void;
  readonly onFailed?: (failure: ProviderManagementFailure) => void;
}

export interface UpdateConfigurationRequest {
  readonly configurationId: ConfigurationId;
  readonly expectedRevision: ConfigurationRevision;
  readonly input: ClientConfigurationInput;
  readonly acknowledgement: AcceptedAcknowledgement;
}

/** The minimum a create response must expose for post-create continuation. */
export interface CreatedConfigurationResponse {
  readonly configuration?: { readonly configurationId: ConfigurationId } | undefined;
}

/**
 * The minimum a test response must expose. A resolved test call is not a
 * passed test: the server answers HTTP 200 with `status: "failed"` whenever the
 * conformance probe did not pass, and the readiness explanation carries the
 * reason the surface should report.
 */
export interface TestedConfigurationResponse {
  readonly status: "succeeded" | "failed";
  readonly readiness: { readonly explanation: string };
}

export interface ProviderManagementMutations {
  readonly createConfiguration: (request: {
    input: ClientConfigurationInput;
    acknowledgement: AcceptedAcknowledgement;
  }) => Promise<CreatedConfigurationResponse>;
  readonly updateConfiguration: (request: UpdateConfigurationRequest) => Promise<unknown>;
  readonly deleteConfiguration: (request: {
    configurationId: ConfigurationId;
    expectedRevision?: ConfigurationRevision;
  }) => Promise<unknown>;
  readonly inspectConfiguration: (configurationId: ConfigurationId) => Promise<unknown>;
  readonly testConfiguration: (
    configurationId: ConfigurationId,
  ) => Promise<TestedConfigurationResponse>;
  readonly selectConfiguration: (
    configurationId: ConfigurationId,
    modelId: ExactModelId,
  ) => Promise<unknown>;
}

export type ProviderManagementOutcome =
  | { readonly status: "succeeded" }
  | { readonly status: "failed"; readonly message: string }
  /** The action needed input the caller does not have yet; a dialog was opened. */
  | { readonly status: "input-required" };

export interface UseProviderManagementInput {
  readonly providers: readonly ProviderListRow[];
  readonly mutations: ProviderManagementMutations;
  readonly notifier?: ProviderManagementNotifier;
}

const INPUT_REQUIRED = { status: "input-required" } as const;
const SUCCEEDED = { status: "succeeded" } as const;

/**
 * The provider dialog-owner state machine and its configuration handlers,
 * shared by the Web and Ink provider surfaces.
 *
 * Dialog owners carry a monotonic id so a late response can only close or
 * replace the dialog it actually started; a newer dialog is never clobbered.
 * Every handler is caught and reports through the notifier, so no save family
 * can reject into an unhandled rejection.
 */
export function useProviderManagement({
  providers,
  mutations,
  notifier,
}: UseProviderManagementInput) {
  const [dialogOwner, setDialogOwner] = useState<ProviderDialogOwner | null>(null);
  const nextDialogOwnerId = useRef(0);
  const { isSubmitting, withGuard } = useSubmitGuard();

  const takeDialogOwnerId = () => {
    nextDialogOwnerId.current += 1;
    return nextDialogOwnerId.current;
  };

  const run = async (
    event: ProviderManagementEvent,
    mutate: () => Promise<void>,
  ): Promise<ProviderManagementOutcome> => {
    try {
      const started = await withGuard(mutate);
      if (!started) return INPUT_REQUIRED;
      notifier?.onSucceeded?.(event);
      return SUCCEEDED;
    } catch (error) {
      const message = getErrorMessage(error, "Unknown error");
      notifier?.onFailed?.({ ...event, message });
      return { status: "failed", message };
    }
  };

  const replaceOwner = (owner: ProviderDialogOwner, next: ProviderDialogOwner | null) => {
    setDialogOwner((current) => (current === owner ? next : current));
  };

  const openSetupDialog = (rowId: string) => {
    if (isSubmitting) return;
    setDialogOwner({ kind: "setup", id: takeDialogOwnerId(), rowId });
  };

  const openModelDialog = (rowId: string) => {
    if (isSubmitting) return;
    const configurationId = findProviderById(providers, rowId)?.configuration?.configurationId;
    if (!configurationId) return;
    setDialogOwner({ kind: "model", id: takeDialogOwnerId(), rowId, configurationId });
  };

  const closeDialog = (owner: ProviderDialogOwner) => {
    replaceOwner(owner, null);
  };

  const handleCreateConfiguration = async (
    owner: SetupDialogOwner,
    input: ClientConfigurationInput,
    options?: {
      continueToModelSelection?: boolean;
      acknowledgement: AcceptedAcknowledgement;
    },
  ) => {
    const row = findProviderById(providers, owner.rowId);
    // The created configuration is the only reliable identity here: the row
    // list has not refreshed yet, so it cannot supply the new id.
    let configurationId: ConfigurationId | undefined;
    const outcome = await run({ action: "create", row, modelId: null }, async () => {
      if (!options?.acknowledgement) {
        throw new Error("Create configuration requires notice acknowledgement");
      }
      const response = await mutations.createConfiguration({
        input,
        acknowledgement: options.acknowledgement,
      });
      configurationId = response.configuration?.configurationId;
    });
    // Owner swaps happen after the submit guard has cleared: closing inside it
    // unmounts the dialog while the trigger button is still natively disabled,
    // so focus restore lands on <body> instead of the trigger.
    if (outcome.status !== "succeeded") return outcome;
    const modelOwner: ModelDialogOwner | null =
      options?.continueToModelSelection && configurationId
        ? { kind: "model", id: takeDialogOwnerId(), rowId: owner.rowId, configurationId }
        : null;
    replaceOwner(owner, modelOwner);
    return outcome;
  };

  const handleUpdateConfiguration = async (
    owner: SetupDialogOwner,
    request: UpdateConfigurationRequest,
    options?: { continueToModelSelection?: boolean },
  ) => {
    const row = findProviderById(providers, owner.rowId);
    const outcome = await run({ action: "update", row, modelId: null }, async () => {
      await mutations.updateConfiguration(request);
    });
    if (outcome.status !== "succeeded") return outcome;
    const modelOwner: ModelDialogOwner | null = options?.continueToModelSelection
      ? {
          kind: "model",
          id: takeDialogOwnerId(),
          rowId: owner.rowId,
          configurationId: request.configurationId,
        }
      : null;
    replaceOwner(owner, modelOwner);
    return outcome;
  };

  // A record this build could not decode has no row and no revision: the id is
  // all the surfaces have, and removal is all they offer for it.
  const handleDeleteConfiguration = (
    configurationId: ConfigurationId,
    expectedRevision?: ConfigurationRevision,
  ) => {
    const row = findProviderById(providers, configurationId);
    return run({ action: "delete", row, modelId: null }, async () => {
      await mutations.deleteConfiguration({ configurationId, expectedRevision });
    });
  };

  const handleInspectConfiguration = (configurationId: ConfigurationId) => {
    const row = findProviderById(providers, configurationId);
    return run({ action: "inspect", row, modelId: null }, async () => {
      await mutations.inspectConfiguration(configurationId);
    });
  };

  const handleTestConfiguration = (configurationId: ConfigurationId) => {
    const row = findProviderById(providers, configurationId);
    return run({ action: "test", row, modelId: null }, async () => {
      const response = await mutations.testConfiguration(configurationId);
      if (response.status !== "succeeded") {
        throw new Error(response.readiness.explanation);
      }
    });
  };

  const handleSelectConfiguration = async (
    row: ProviderListRow,
    modelId?: ExactModelId,
  ): Promise<ProviderManagementOutcome> => {
    if (isSubmitting) return INPUT_REQUIRED;

    const configurationId = row.configuration?.configurationId;
    if (!configurationId) {
      openSetupDialog(getProviderRowId(row));
      return INPUT_REQUIRED;
    }
    if (!modelId) {
      openModelDialog(getProviderRowId(row));
      return INPUT_REQUIRED;
    }

    return run({ action: "select", row, modelId }, async () => {
      await mutations.selectConfiguration(configurationId, modelId);
    });
  };

  const handleSelectModel = async (owner: ModelDialogOwner, modelId: ExactModelId) => {
    const row = findProviderById(providers, owner.rowId);
    const outcome = await run({ action: "select-model", row, modelId }, async () => {
      await mutations.selectConfiguration(owner.configurationId, modelId);
    });
    if (outcome.status === "succeeded") replaceOwner(owner, null);
    return outcome;
  };

  const handleDispatchReadinessAction = async (
    row: ProviderListRow,
  ): Promise<ProviderManagementOutcome> => {
    if (isSubmitting) return INPUT_REQUIRED;

    const action = row.readiness.action;
    if (action === "create" || action === "update") {
      openSetupDialog(getProviderRowId(row));
      return INPUT_REQUIRED;
    }

    const configurationId = row.configuration?.configurationId;
    if (!configurationId) return INPUT_REQUIRED;

    if (action === "inspect") return handleInspectConfiguration(configurationId);
    if (action === "test") return handleTestConfiguration(configurationId);
    if (action === "select")
      return handleSelectConfiguration(row, row.configuration?.selectedModelId ?? undefined);

    return INPUT_REQUIRED;
  };

  return {
    isSubmitting,
    dialogOwner,
    openSetupDialog,
    openModelDialog,
    closeDialog,
    handleCreateConfiguration,
    handleUpdateConfiguration,
    handleDeleteConfiguration,
    handleSelectConfiguration,
    handleSelectModel,
    handleDispatchReadinessAction,
  };
}
