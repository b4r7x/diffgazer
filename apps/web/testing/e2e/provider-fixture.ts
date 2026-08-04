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
  LOCAL_OPENAI_CONFIGURATION,
  makeConfigurationInitResponse,
  READY_GEMINI_CONFIGURATION,
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
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: "file",
  agentExecution: "parallel",
};

export const ONBOARDING_E2E_INIT: ConfigurationInitResponse = {
  schemaVersion: 2,
  configurations: [],
  selectedConfigurationId: null,
  settings: {
    theme: "terminal",
    defaultLenses: ["correctness"],
    defaultProfile: null,
    secretsStorage: null,
    severityThreshold: "low",
    agentExecution: "parallel",
  },
  project: { projectId: "onboarding-responsive", path: "/repo", trust: null },
};

export const PROVIDER_E2E_INIT = makeProviderE2eInitResponse();

function makeProviderE2eInitResponse(): ConfigurationInitResponse {
  return {
    ...makeConfigurationInitResponse(
      [
        configurationStatus(READY_GEMINI_CONFIGURATION, "ready"),
        configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
      ],
      "gemini-primary",
    ),
    settings: SETTINGS_FIXTURE,
  };
}

export const PROVIDER_E2E_LIST: ConfigurationListResponse = {
  schemaVersion: 2,
  configurations: PROVIDER_E2E_INIT.configurations,
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
            status: "local-endpoint-unreachable",
            ready: false,
            evidenceStatus: "failed",
            checkedAt: "2026-07-31T12:00:00.000Z",
            acknowledgement: { status: "not-applicable" },
            ...READINESS_PRESENTATION["local-endpoint-unreachable"],
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
    let response = succeededAction("inspect", READY_GEMINI_CONFIGURATION);
    if (action?.action === "test") {
      response = succeededAction("test");
    } else if (action?.action === "update") {
      response = succeededAction("update");
    }
    assertClientSafePayload(response, route.request().url());
    await route.fulfill({ json: response });
  });
}
