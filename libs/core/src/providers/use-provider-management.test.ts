/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConfigurationStatus } from "../schemas/config/configuration-status.js";
import type { ClientConfigurationInput } from "../schemas/config/provider-config.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "../schemas/config/readiness.js";
import { getProviderRowId, mapProviderList, type ProviderListRow } from "./list.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";
import {
  type ProviderManagementFailure,
  type ProviderManagementMutations,
  useProviderManagement,
} from "./use-provider-management.js";

const CHECKED_AT = "2026-07-31T10:00:00.000Z";
const GEMINI_NOTICE = PRODUCT_REGISTRY.gemini.notice;

function readyStatus(): ConfigurationStatus {
  return {
    configuration: {
      configurationId: "gemini-primary",
      revision: 3,
      status: "supported",
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      selectedModelId: "gemini-2.5-flash",
      notices: [
        {
          ...GEMINI_NOTICE,
          billing: [...GEMINI_NOTICE.billing],
          privacy: [...GEMINI_NOTICE.privacy],
        },
      ],
      availableActions: ["inspect", "select", "test", "update", "delete"],
    },
    readiness: ReadinessSchema.parse({
      status: "ready",
      ready: true,
      evidenceStatus: "passed",
      checkedAt: CHECKED_AT,
      acknowledgement: {
        status: "accepted",
        noticeId: GEMINI_NOTICE.id,
        noticeVersion: GEMINI_NOTICE.noticeVersion,
        acceptedAt: CHECKED_AT,
      },
      ...READINESS_PRESENTATION.ready,
    }),
  };
}

const HOSTED_INPUT = {
  transportFamily: "hosted-api",
  productId: "gemini",
  endpoint: "https://generativelanguage.googleapis.com/v1beta",
  credential: { kind: "literal", value: "write-only-value" },
} as unknown as ClientConfigurationInput;

function makeMutations(
  overrides: Partial<ProviderManagementMutations> = {},
): ProviderManagementMutations {
  return {
    createConfiguration: vi.fn(async () => ({
      configuration: { configurationId: "gemini-created" },
    })),
    updateConfiguration: vi.fn(async () => undefined),
    deleteConfiguration: vi.fn(async () => undefined),
    inspectConfiguration: vi.fn(async () => undefined),
    testConfiguration: vi.fn(async () => undefined),
    selectConfiguration: vi.fn(async () => undefined),
    ...overrides,
  };
}

function setup(
  mutations: ProviderManagementMutations,
  providers: readonly ProviderListRow[] = mapProviderList([readyStatus()]),
) {
  const failures: ProviderManagementFailure[] = [];
  const succeeded: string[] = [];
  const hook = renderHook(() =>
    useProviderManagement({
      providers,
      mutations,
      notifier: {
        onFailed: (failure) => failures.push(failure),
        onSucceeded: (event) => succeeded.push(event.action),
      },
    }),
  );
  return { hook, failures, succeeded, providers };
}

function unconfiguredRowId(providers: readonly ProviderListRow[]): string {
  const row = providers.find(({ configuration }) => configuration === null);
  if (!row) throw new Error("Expected an unconfigured provider row");
  return getProviderRowId(row);
}

describe("useProviderManagement", () => {
  it("continues to model selection using the created configuration id", async () => {
    const mutations = makeMutations();
    const { hook, providers } = setup(mutations);
    const rowId = unconfiguredRowId(providers);

    act(() => hook.result.current.openSetupDialog(rowId));
    const owner = hook.result.current.dialogOwner;
    if (owner?.kind !== "setup") throw new Error("Expected a setup dialog owner");

    await act(async () => {
      await hook.result.current.handleCreateConfiguration(owner, HOSTED_INPUT, {
        continueToModelSelection: true,
      });
    });

    expect(hook.result.current.dialogOwner).toMatchObject({
      kind: "model",
      rowId,
      configurationId: "gemini-created",
    });
  });

  it("keeps the setup dialog closed when creation reports no configuration", async () => {
    const mutations = makeMutations({ createConfiguration: vi.fn(async () => ({})) });
    const { hook, providers } = setup(mutations);

    act(() => hook.result.current.openSetupDialog(unconfiguredRowId(providers)));
    const owner = hook.result.current.dialogOwner;
    if (owner?.kind !== "setup") throw new Error("Expected a setup dialog owner");

    await act(async () => {
      await hook.result.current.handleCreateConfiguration(owner, HOSTED_INPUT, {
        continueToModelSelection: true,
      });
    });

    expect(hook.result.current.dialogOwner).toBeNull();
  });

  it("reports a rejected save as a failed outcome instead of rejecting", async () => {
    const mutations = makeMutations({
      createConfiguration: vi.fn(async () => {
        throw new Error("Endpoint refused the credential");
      }),
    });
    const { hook, failures, providers } = setup(mutations);

    act(() => hook.result.current.openSetupDialog(unconfiguredRowId(providers)));
    const owner = hook.result.current.dialogOwner;
    if (owner?.kind !== "setup") throw new Error("Expected a setup dialog owner");

    let outcome: Awaited<ReturnType<typeof hook.result.current.handleCreateConfiguration>> | null =
      null;
    await act(async () => {
      outcome = await hook.result.current.handleCreateConfiguration(owner, HOSTED_INPUT);
    });

    expect(outcome).toEqual({ status: "failed", message: "Endpoint refused the credential" });
    expect(failures).toEqual([
      expect.objectContaining({ action: "create", message: "Endpoint refused the credential" }),
    ]);
    // A failed save must leave its dialog open so the surface can render the error.
    expect(hook.result.current.dialogOwner).toBe(owner);
  });

  it("does not let a stale model dialog close a newer dialog", async () => {
    let releaseSelect: (() => void) | undefined;
    const mutations = makeMutations({
      selectConfiguration: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseSelect = resolve;
          }),
      ),
    });
    const { hook } = setup(mutations);

    act(() => hook.result.current.openModelDialog("gemini-primary"));
    const staleOwner = hook.result.current.dialogOwner;
    if (staleOwner?.kind !== "model") throw new Error("Expected a model dialog owner");

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = hook.result.current.handleSelectModel(staleOwner, "gemini-2.5-flash");
    });

    act(() => hook.result.current.closeDialog(staleOwner));
    act(() => hook.result.current.openSetupDialog("gemini-primary"));
    const currentOwner = hook.result.current.dialogOwner;

    await act(async () => {
      releaseSelect?.();
      await pending;
    });

    expect(hook.result.current.dialogOwner).toBe(currentOwner);
  });

  it("routes the delete readiness action through the caught state machine", async () => {
    const deleteConfiguration = vi.fn(async () => {
      throw new Error("Secret material could not be removed");
    });
    const mutations = makeMutations({ deleteConfiguration });
    const { hook, failures, providers } = setup(mutations);
    const row = providers.find(
      ({ configuration }) => configuration?.configurationId === "gemini-primary",
    );
    if (!row) throw new Error("Expected the configured row");

    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.handleDeleteConfiguration(
        "gemini-primary",
        row.configuration?.revision ?? 0,
      );
    });

    expect(outcome).toEqual({
      status: "failed",
      message: "Secret material could not be removed",
    });
    expect(failures).toEqual([expect.objectContaining({ action: "delete" })]);
  });

  it("opens the model dialog instead of selecting a configuration without a model", async () => {
    const mutations = makeMutations();
    const { hook, providers } = setup(mutations);
    const row = providers.find(
      ({ configuration }) => configuration?.configurationId === "gemini-primary",
    );
    if (!row) throw new Error("Expected the configured row");

    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.handleSelectConfiguration(row);
    });

    expect(outcome).toEqual({ status: "input-required" });
    expect(mutations.selectConfiguration).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(hook.result.current.dialogOwner).toMatchObject({
        kind: "model",
        configurationId: "gemini-primary",
      }),
    );
  });
});
