import type { BoundApi } from "@diffgazer/core/api";
import { ClientConfigurationActionResponseSchema } from "@diffgazer/core/schemas/config";
import {
  configurationStatus,
  makeReadiness,
  READY_GEMINI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { vi } from "vitest";

const readyReadiness = makeReadiness("ready", "gemini");

export function createConfigurationActionMocks(): Pick<
  BoundApi,
  | "createConfiguration"
  | "inspectConfiguration"
  | "selectConfiguration"
  | "testConfiguration"
  | "updateConfiguration"
  | "deleteConfiguration"
  | "executeConfigurationAction"
> {
  return {
    createConfiguration: vi.fn(async (_input) =>
      ClientConfigurationActionResponseSchema.parse({
        action: "create",
        status: "succeeded",
        configuration: READY_GEMINI_CONFIGURATION,
      }),
    ) as BoundApi["createConfiguration"],
    inspectConfiguration: vi.fn(async (_configurationId) =>
      ClientConfigurationActionResponseSchema.parse({
        action: "inspect",
        status: "succeeded",
        configuration: READY_GEMINI_CONFIGURATION,
      }),
    ) as BoundApi["inspectConfiguration"],
    selectConfiguration: vi.fn(async (_configurationId, _modelId) =>
      ClientConfigurationActionResponseSchema.parse({
        action: "select",
        status: "succeeded",
        configuration: READY_GEMINI_CONFIGURATION,
      }),
    ) as BoundApi["selectConfiguration"],
    testConfiguration: vi.fn(async (_configurationId) =>
      ClientConfigurationActionResponseSchema.parse({
        action: "test",
        status: "succeeded",
        configuration: READY_GEMINI_CONFIGURATION,
        readiness: readyReadiness,
      }),
    ) as BoundApi["testConfiguration"],
    updateConfiguration: vi.fn(
      async (_configurationId, _expectedRevision, _input, _acknowledgement) =>
        ClientConfigurationActionResponseSchema.parse({
          action: "update",
          status: "succeeded",
          configuration: READY_GEMINI_CONFIGURATION,
        }),
    ) as BoundApi["updateConfiguration"],
    deleteConfiguration: vi.fn(async (_configurationId, _expectedRevision) =>
      ClientConfigurationActionResponseSchema.parse({
        action: "delete",
        status: "succeeded",
      }),
    ) as BoundApi["deleteConfiguration"],
    executeConfigurationAction: vi.fn(async (action) =>
      ClientConfigurationActionResponseSchema.parse({
        action: action.action,
        status: "succeeded",
        ...(action.action !== "delete" ? { configuration: READY_GEMINI_CONFIGURATION } : {}),
        ...(action.action === "test" ? { readiness: readyReadiness } : {}),
      }),
    ) as BoundApi["executeConfigurationAction"],
  };
}

export const readyConfigurationStatus = configurationStatus(READY_GEMINI_CONFIGURATION, "ready");
