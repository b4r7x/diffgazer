import type { BoundApi } from "@diffgazer/core/api";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { ConfigurationInitResponse } from "@diffgazer/core/schemas/config";
import {
  makeConfigurationListResponse,
  makeNonReadyInitResponse,
  makeReadyInitResponse,
} from "@diffgazer/core/testing/provider-fixtures";
import { vi } from "vitest";

export const SHELL_SETTINGS_FIXTURE: ConfigurationInitResponse["settings"] = {
  theme: "terminal",
  defaultLenses: [] as ConfigurationInitResponse["settings"]["defaultLenses"],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: "file",
  agentExecution: "parallel",
};

export const SHELL_TRUSTED_PROJECT: ConfigurationInitResponse["project"] = {
  projectId: "proj-1",
  path: "/repo",
  trust: {
    projectId: "proj-1",
    repoRoot: "/repo",
    trustedAt: "2026-01-01T00:00:00.000Z",
    trustMode: "persistent",
    capabilities: { readFiles: true, runCommands: false },
  },
};

export function makeShellInitResponse(
  overrides: Partial<ConfigurationInitResponse> = {},
): ConfigurationInitResponse {
  return {
    ...makeReadyInitResponse(),
    settings: SHELL_SETTINGS_FIXTURE,
    project: SHELL_TRUSTED_PROJECT,
    ...overrides,
  };
}

export function makeShellApiOverrides(
  init: ConfigurationInitResponse = makeShellInitResponse(),
): Partial<BoundApi> {
  return {
    loadConfigurationInit: vi.fn<BoundApi["loadConfigurationInit"]>().mockResolvedValue(init),
    listConfigurations: vi
      .fn<BoundApi["listConfigurations"]>()
      .mockResolvedValue(makeConfigurationListResponse(init)),
  };
}

export function selectedProductId(init: ConfigurationInitResponse): string | undefined {
  const selected = init.configurations.find(
    ({ configuration }) => configuration.configurationId === init.selectedConfigurationId,
  )?.configuration;
  if (!selected) return undefined;
  return selected.productId;
}

export function selectedProductLabel(init: ConfigurationInitResponse): string {
  const selected = init.configurations.find(
    ({ configuration }) => configuration.configurationId === init.selectedConfigurationId,
  )?.configuration;
  if (!selected) return "Not configured";
  return PRODUCT_REGISTRY[selected.productId].presentation.name;
}

export function selectedModelLabel(init: ConfigurationInitResponse): string | undefined {
  const selected = init.configurations.find(
    ({ configuration }) => configuration.configurationId === init.selectedConfigurationId,
  )?.configuration;
  if (!selected) return undefined;
  return selected.selectedModelId ?? undefined;
}

export { makeNonReadyInitResponse, makeReadyInitResponse };
