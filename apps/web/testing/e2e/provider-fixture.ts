import type {
  ClientConfigurationActionResponse,
  ClientConfigurationSummary,
  ConfigurationInitResponse,
  ConfigurationListResponse,
  ConfigurationStatus,
} from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  READINESS_PRESENTATION,
} from "@diffgazer/core/schemas/config";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  LOCAL_OPENAI_CONFIGURATION,
  makeConfigurationInitResponse,
} from "@diffgazer/core/testing/provider-fixtures";
import type { Page, Route } from "@playwright/test";
import {
  assertClientSafeDom,
  assertClientSafePayload,
} from "../../src/testing/client-safe-assertions";

export { assertClientSafeDom, assertClientSafePayload };

const SETTINGS_FIXTURE: ConfigurationInitResponse["settings"] = {
  theme: "terminal",
  defaultLenses: ["correctness"],
  effectiveCallTokenCap: 49_152,
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: "file",
  agentExecution: "parallel",
  providerConsent: { version: 1, acceptedAt: "2026-08-01T09:00:00.000Z" },
};

export const ONBOARDING_E2E_INIT: ConfigurationInitResponse = {
  schemaVersion: 2,
  configurations: [],
  unrecognizedConfigurations: [],
  selectedConfigurationId: null,
  settings: {
    theme: "terminal",
    defaultLenses: ["correctness"],
    effectiveCallTokenCap: 49_152,
    defaultProfile: null,
    secretsStorage: null,
    severityThreshold: "low",
    agentExecution: "parallel",
    providerConsent: null,
  },
  project: { projectId: "onboarding-responsive", path: "/repo", trust: null },
};

export const PROVIDER_E2E_INIT = makeProviderE2eInitResponse();

function makeProviderE2eInitResponse(): ConfigurationInitResponse {
  return {
    ...makeConfigurationInitResponse(
      [
        configurationStatus(GEMINI_CONFIGURATION, "ready"),
        configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-conformance-failed"),
      ],
      "gemini-primary",
    ),
    settings: SETTINGS_FIXTURE,
  };
}

const PROVIDER_E2E_LIST: ConfigurationListResponse = {
  schemaVersion: 2,
  configurations: PROVIDER_E2E_INIT.configurations,
  unrecognizedConfigurations: PROVIDER_E2E_INIT.unrecognizedConfigurations,
  selectedConfigurationId: PROVIDER_E2E_INIT.selectedConfigurationId,
};

function succeededAction(
  action: ClientConfigurationActionResponse["action"],
  configuration: ClientConfigurationSummary = LOCAL_OPENAI_CONFIGURATION,
): ClientConfigurationActionResponse {
  return ClientConfigurationActionResponseSchema.parse({
    action,
    status: "succeeded",
    ...(action === "delete" ? {} : { configuration }),
    ...(action === "test"
      ? {
          readiness: {
            status: "local-conformance-failed",
            ready: false,
            evidenceStatus: "failed",
            checkedAt: "2026-07-31T12:00:00.000Z",
            acknowledgement: { status: "not-applicable" },
            ...READINESS_PRESENTATION["local-conformance-failed"],
          },
        }
      : {}),
  });
}

function validateFixture(statuses: ConfigurationStatus[]): void {
  for (const status of statuses) {
    assertClientSafePayload(status, "configuration status");
  }
}

validateFixture(PROVIDER_E2E_INIT.configurations);

export async function mockProtectedProviderApi(page: Page): Promise<void> {
  await page.route("**/api/health", (route) => route.fulfill({ status: 200, json: { ok: true } }));
  await page.route("**/api/settings", (route) => route.fulfill({ json: SETTINGS_FIXTURE }));

  await page.route("**/api/config/init", async (route) => {
    const body = PROVIDER_E2E_INIT;
    assertClientSafePayload(body, "/api/config/init");
    await route.fulfill({ json: body });
  });

  await page.route("**/api/config/providers", async (route) => {
    const body = PROVIDER_E2E_LIST;
    assertClientSafePayload(body, "/api/config/providers");
    await route.fulfill({ json: body });
  });

  await page.route("**/api/config/actions", async (route: Route) => {
    const action = route.request().postDataJSON() as { action?: string } | null;
    let response = succeededAction("inspect", GEMINI_CONFIGURATION);
    if (action?.action === "test") {
      response = succeededAction("test");
    } else if (action?.action === "update") {
      response = succeededAction("update");
    }
    assertClientSafePayload(response, route.request().url());
    await route.fulfill({ json: response });
  });
}
