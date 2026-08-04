import { type BoundApi, createApi } from "@diffgazer/core/api";
import { getInitialWizardData, type OnboardingDraft } from "@diffgazer/core/onboarding";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { escapeRegExp } from "@diffgazer/core/redaction";
import type {
  ClientConfigurationAction,
  ConfigurationInitResponse,
  ConfigurationModelsResponse,
} from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  READINESS_PRESENTATION,
  REMOVED_PRODUCT_ID,
  SELECTABLE_PRODUCTS,
} from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

let OnboardingWizard: typeof import("./wizard").OnboardingWizard;
let ConfigProvider: typeof import("@/hooks/use-config").ConfigProvider;
let KeyboardProvider: typeof import("@diffgazer/keys").KeyboardProvider;
let ApiProvider: typeof import("@diffgazer/core/api/hooks").ApiProvider;
let FooterProvider: typeof import("@diffgazer/core/footer").FooterProvider;

function geminiWalkthroughDraft(): OnboardingDraft {
  const draft = getInitialWizardData("gemini");
  const notice = PRODUCT_REGISTRY.gemini.notice;
  if (draft.configurationInput.transportFamily !== "hosted-api") {
    throw new Error("Expected hosted draft");
  }
  return {
    ...draft,
    configurationInput: {
      ...draft.configurationInput,
      credential: { kind: "environment" },
    },
    selectedModelId: "gemini-2.5-pro",
    conformanceStatus: "passed",
    acknowledgement: {
      status: "accepted",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
      acceptedAt: "2026-07-31T12:00:00.000Z",
    },
  };
}

function configurationSummary(
  data: OnboardingDraft,
  selectedModelId: string | null = null,
  revision = 3,
) {
  const input = data.configurationInput;
  if (input.transportFamily !== "hosted-api") {
    throw new Error("Wizard walkthrough fixture requires hosted configuration");
  }
  return {
    configurationId: "created-configuration",
    revision,
    status: "supported" as const,
    transportFamily: "hosted-api" as const,
    productId: input.productId,
    endpoint: input.endpoint,
    region: input.region,
    workspace: input.workspace,
    selectedModelId,
    notices: [
      {
        id: PRODUCT_REGISTRY[data.plan.productId].notice.id,
        noticeVersion: PRODUCT_REGISTRY[data.plan.productId].notice.noticeVersion,
        acknowledgement: PRODUCT_REGISTRY[data.plan.productId].notice.acknowledgement,
        acknowledgeBefore: PRODUCT_REGISTRY[data.plan.productId].notice.acknowledgeBefore,
        renewAcknowledgementOn: PRODUCT_REGISTRY[data.plan.productId].notice.renewAcknowledgementOn,
        billing: [...PRODUCT_REGISTRY[data.plan.productId].notice.billing],
        privacy: [...PRODUCT_REGISTRY[data.plan.productId].notice.privacy],
      },
    ],
    availableActions: ["inspect", "select", "test", "update", "delete"] as const,
  };
}

function discoveryReadiness(data: OnboardingDraft) {
  const notice = PRODUCT_REGISTRY[data.plan.productId].notice;
  return {
    status: "acknowledgement-required" as const,
    ready: false as const,
    evidenceStatus: "passed" as const,
    checkedAt: "2026-07-31T12:01:00.000Z",
    acknowledgement: {
      status: "required" as const,
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
    },
    ...READINESS_PRESENTATION["acknowledgement-required"],
  };
}

function readyReadiness(data: OnboardingDraft) {
  if (data.acknowledgement.status !== "accepted") {
    throw new Error("Test fixture requires an accepted acknowledgement");
  }
  return {
    status: "ready" as const,
    ready: true as const,
    evidenceStatus: "passed" as const,
    checkedAt: "2026-07-31T12:01:00.000Z",
    acknowledgement: data.acknowledgement,
    ...READINESS_PRESENTATION.ready,
  };
}

function makeWizardActionHandler(data: OnboardingDraft) {
  let revision = 3;
  let modelSelected = false;

  return async (action: ClientConfigurationAction) => {
    if (action.action === "create") {
      return ClientConfigurationActionResponseSchema.parse({
        action: "create",
        status: "succeeded",
        configuration: configurationSummary(data, null, revision),
      });
    }
    if (action.action === "select") {
      revision = Math.max(revision, 4);
      modelSelected = true;
      return ClientConfigurationActionResponseSchema.parse({
        action: "select",
        status: "succeeded",
        configuration: configurationSummary(data, action.modelId, revision),
      });
    }
    if (action.action === "update") {
      revision = Math.max(revision, 5);
      return ClientConfigurationActionResponseSchema.parse({
        action: "update",
        status: "succeeded",
        configuration: configurationSummary(data, data.selectedModelId, revision),
      });
    }
    if (action.action === "test") {
      return ClientConfigurationActionResponseSchema.parse({
        action: "test",
        status: "succeeded",
        configuration: configurationSummary(
          data,
          modelSelected ? data.selectedModelId : null,
          revision,
        ),
        readiness: modelSelected ? readyReadiness(data) : discoveryReadiness(data),
      });
    }
    if (action.action === "delete") {
      return ClientConfigurationActionResponseSchema.parse({
        action: "delete",
        status: "succeeded",
      });
    }
    return ClientConfigurationActionResponseSchema.parse({
      action: action.action,
      status: "succeeded",
    });
  };
}

function makeModelsResponse(modelIds: string[]): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: "created-configuration",
    productId: "gemini",
    transportFamily: "hosted-api",
    models: modelIds.map((id) => ({ id, name: id, description: "", tier: "paid" as const })),
    checkedAt: "2026-07-31T12:02:00.000Z",
    source: "snapshot",
    cached: false,
  };
}

function makeInitResponse(
  overrides: Partial<ConfigurationInitResponse> = {},
): ConfigurationInitResponse {
  return {
    schemaVersion: 2,
    configurations: [
      {
        configuration: {
          configurationId: "legacy-removed-zai-plan",
          revision: 4,
          status: "removed",
          transportFamily: "hosted-api",
          productId: REMOVED_PRODUCT_ID,
          selectedModelId: null,
          notices: [],
          availableActions: ["inspect", "delete"],
        },
        readiness: {
          status: "removed",
          ready: false,
          evidenceStatus: "not-checked",
          checkedAt: null,
          acknowledgement: { status: "not-applicable" },
          ...READINESS_PRESENTATION.removed,
        },
      },
    ],
    selectedConfigurationId: null,
    settings: {
      theme: "terminal",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: null,
      agentExecution: "parallel",
    },
    project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
    ...overrides,
  };
}

let mockLoadConfigurationInit: Mock<BoundApi["loadConfigurationInit"]>;
let mockSaveSettings: Mock<BoundApi["saveSettings"]>;
let mockExecuteConfigurationAction: Mock<BoundApi["executeConfigurationAction"]>;
let mockGetConfigurationModels: Mock<BoundApi["getConfigurationModels"]>;

function createTestApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    loadConfigurationInit: mockLoadConfigurationInit,
    saveSettings: mockSaveSettings,
    executeConfigurationAction: mockExecuteConfigurationAction,
    getConfigurationModels: mockGetConfigurationModels,
  } satisfies BoundApi;
}

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const api = createTestApi();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <FooterProvider>
              <KeyboardProvider>{children}</KeyboardProvider>
            </FooterProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  }

  return render(<OnboardingWizard />, { wrapper: Wrapper });
}

function getRadio(name: RegExp | string) {
  return screen.getByRole("radio", { name });
}

async function expectStep(title: RegExp) {
  await waitFor(() =>
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument(),
  );
}

async function clickNext(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^next$/i }));
}

describe("OnboardingWizard", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ ApiProvider } = await import("@diffgazer/core/api/hooks"));
    ({ FooterProvider } = await import("@diffgazer/core/footer"));
    ({ ConfigProvider } = await import("@/hooks/use-config"));
    ({ KeyboardProvider } = await import("@diffgazer/keys"));
    ({ OnboardingWizard } = await import("./wizard"));
    mockNavigate.mockReset();
    mockLoadConfigurationInit = vi
      .fn<BoundApi["loadConfigurationInit"]>()
      .mockResolvedValue(makeInitResponse());
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockExecuteConfigurationAction = vi
      .fn<BoundApi["executeConfigurationAction"]>()
      .mockImplementation(makeWizardActionHandler(geminiWalkthroughDraft()));
    mockGetConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(makeModelsResponse(["gemini-2.5-pro"]));
  });

  it("marks progress from the dynamic setup plan length", async () => {
    renderWizard();
    await expectStep(/select product/i);
    const progress = screen.getByLabelText("Setup progress");
    expect(within(progress).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
  });

  it("shows exactly 13 selectable products and removed migration guidance without a removed radio", async () => {
    renderWizard();
    await expectStep(/select product/i);
    expect(screen.getAllByRole("radio")).toHaveLength(13);
    await waitFor(() => {
      expect(screen.getByText(/Z\.AI Coding Plan/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("radio", { name: /Z\.AI Coding Plan/i })).not.toBeInTheDocument();
  });

  it("uses shared product names from the registry projection", async () => {
    renderWizard();
    await expectStep(/select product/i);
    const firstProduct = SELECTABLE_PRODUCTS[0];
    if (!firstProduct) throw new Error("SELECTABLE_PRODUCTS is empty");
    expect(getRadio(new RegExp(escapeRegExp(firstProduct.name), "i"))).toHaveTextContent(
      firstProduct.description,
    );
  });

  it("walks a hosted plan through discovered models and explicit acknowledgement without early credential saves", async () => {
    const user = userEvent.setup();
    renderWizard();

    await expectStep(/select product/i);
    await clickNext(user);
    await expectStep(/configure endpoint/i);
    await clickNext(user);
    await expectStep(/configure authentication/i);
    await user.click(screen.getByRole("radio", { name: /environment reference/i }));
    await clickNext(user);
    await expectStep(/select model/i);
    // The model step lists exactly what discovery returned for the draft
    // record, never a client-side guess derived from the product policy.
    await user.click(await screen.findByRole("radio", { name: /gemini-2\.5-pro/i }));
    expect(screen.queryByRole("radio", { name: /gemini-2\.5-flash/i })).not.toBeInTheDocument();
    expect(mockGetConfigurationModels).toHaveBeenCalledWith("created-configuration");
    await clickNext(user);
    await expectStep(/verify conformance/i);
    await user.click(screen.getByRole("checkbox"));
    await clickNext(user);
    await expectStep(/accept product notice/i);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /complete setup/i }));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalled();
      expect(mockExecuteConfigurationAction).toHaveBeenCalled();
      expect(
        mockExecuteConfigurationAction.mock.calls.some(([action]) => action.action === "create"),
      ).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
    // Model discovery persists a draft record. Completing setup revokes exactly
    // that record before saving the final tuple, so no orphan is left behind.
    expect(
      mockExecuteConfigurationAction.mock.calls.filter(([action]) => action.action === "delete"),
    ).toHaveLength(1);
  });

  it("places keyboard focus inside each step's content as the wizard advances", async () => {
    const user = userEvent.setup();
    renderWizard();

    await expectStep(/select product/i);
    expect(screen.getByRole("radio", { name: /google gemini/i })).toHaveFocus();

    await clickNext(user);
    await expectStep(/configure endpoint/i);
    expect(screen.getByRole("radio", { name: /global/i })).toHaveFocus();

    await clickNext(user);
    await expectStep(/configure authentication/i);
    expect(screen.getByRole("radio", { name: /enter credential now/i })).toHaveFocus();

    await user.click(screen.getByRole("radio", { name: /environment reference/i }));
    await clickNext(user);
    await expectStep(/select model/i);
    await user.click(await screen.findByRole("radio", { name: /gemini-2\.5-pro/i }));
    await clickNext(user);
    await expectStep(/verify conformance/i);
    expect(screen.getByRole("checkbox")).toHaveFocus();

    await user.click(screen.getByRole("checkbox"));
    await clickNext(user);
    await expectStep(/accept product notice/i);
    expect(screen.getByRole("checkbox")).toHaveFocus();
  });

  it("skips hosted credential prompts for local CLI plans", async () => {
    const user = userEvent.setup();
    renderWizard();

    await expectStep(/select product/i);
    await user.click(getRadio(/OpenAI Codex CLI/i));
    await clickNext(user);
    await expectStep(/configure authentication/i);
    expect(screen.queryByLabelText(/credential/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/OpenAI Codex CLI installation ID/i)).toBeInTheDocument();
  });

  it("shows an inline error when completion fails and keeps the user on the wizard", async () => {
    const user = userEvent.setup();
    const handleAction = makeWizardActionHandler(geminiWalkthroughDraft());
    // Fail the model selection: it belongs to the save flow only, so the draft
    // configuration the model step discovers from is still created normally.
    mockExecuteConfigurationAction.mockImplementation(async (action) => {
      if (action.action === "select") throw new Error("Save failed");
      return handleAction(action);
    });
    renderWizard();

    await expectStep(/select product/i);
    await clickNext(user);
    await expectStep(/configure endpoint/i);
    await clickNext(user);
    await expectStep(/configure authentication/i);
    await user.click(screen.getByRole("radio", { name: /environment reference/i }));
    await clickNext(user);
    await expectStep(/select model/i);
    await user.click(await screen.findByRole("radio", { name: /gemini-2\.5-pro/i }));
    await clickNext(user);
    await expectStep(/verify conformance/i);
    await user.click(screen.getByRole("checkbox"));
    await clickNext(user);
    await expectStep(/accept product notice/i);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /complete setup/i }));

    expect(await screen.findByText("Save failed")).toBeVisible();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
