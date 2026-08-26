import type { Result } from "@diffgazer/core/result";
import type {
  ConfigurationId,
  ConfigurationInitResponse,
  ConfigurationStatus,
  Readiness,
  SettingsConfig,
  UnrecognizedConfiguration,
} from "@diffgazer/core/schemas/config";
import { log } from "../../log.js";
import type {
  DecodedProviderConfigurationRecord,
  SupportedProviderConfigurationRecord,
} from "../provider-config.js";
import type { ProviderReadinessInput } from "../readiness.js";
import { type ConfigurationActionError, configurationActionFailure } from "../types.js";

export type ConfigurationSnapshot = Pick<
  ConfigurationInitResponse,
  "configurations" | "unrecognizedConfigurations" | "selectedConfigurationId" | "settings"
>;

type CapturedConfigurationRow =
  | {
      readonly kind: "unknown";
      readonly record: Extract<DecodedProviderConfigurationRecord, { status: "unknown" }>;
    }
  | {
      readonly kind: "supported";
      readonly configuration: SupportedProviderConfigurationRecord;
      readonly readinessInput: ProviderReadinessInput;
    };

export interface CapturedConfigurationSnapshot {
  readonly rows: readonly CapturedConfigurationRow[];
  readonly selectedConfigurationId: ConfigurationId | null;
  readonly settings: SettingsConfig;
}

type SnapshotDependencies = Readonly<{
  summaryFor: (
    record: SupportedProviderConfigurationRecord,
  ) => Result<ConfigurationStatus["configuration"], ConfigurationActionError>;
  computeReadiness: (input: ProviderReadinessInput) => Readiness;
}>;

export function projectConfigurationSnapshot(
  captured: CapturedConfigurationSnapshot,
  deps: SnapshotDependencies,
): Result<ConfigurationSnapshot, ConfigurationActionError> {
  const configurations: ConfigurationStatus[] = [];
  const unrecognizedConfigurations: UnrecognizedConfiguration[] = [];
  for (const row of captured.rows) {
    if (row.kind === "unknown") {
      // A salvaged id is what makes the record addressable, so it becomes an
      // inert row the user can remove. Without one there is nothing to offer:
      // the record stays preserved on disk and only the warn records it.
      const configurationId = row.record.configurationId;
      if (configurationId) {
        unrecognizedConfigurations.push({ configurationId });
        continue;
      }
      log("warn", "config_list_record_skipped", { reason: "missing configurationId" });
      continue;
    }
    const configurationId = row.configuration.configurationId;
    const summary = deps.summaryFor(row.configuration);
    if (!summary.ok) {
      log("warn", "config_list_record_skipped", {
        configurationId,
        reason: summary.error.code,
      });
      continue;
    }
    try {
      configurations.push({
        configuration: summary.value,
        readiness: deps.computeReadiness(row.readinessInput),
      });
    } catch (cause) {
      log("warn", "config_list_record_skipped", {
        configurationId,
        reason: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }
  if (
    captured.selectedConfigurationId !== null &&
    !configurations.some(
      ({ configuration }) => configuration.configurationId === captured.selectedConfigurationId,
    ) &&
    !unrecognizedConfigurations.some(
      ({ configurationId }) => configurationId === captured.selectedConfigurationId,
    )
  ) {
    return {
      ok: false,
      error: configurationActionFailure(
        "PERSIST_FAILED",
        "Selected configuration could not be inspected",
      ),
    };
  }
  return {
    ok: true,
    value: {
      configurations,
      unrecognizedConfigurations,
      selectedConfigurationId: captured.selectedConfigurationId,
      settings: captured.settings,
    },
  };
}
