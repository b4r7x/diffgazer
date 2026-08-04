import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  buildProviderRows,
  CLI_UNSUPPORTED_CONFIGURATION,
  configurationStatus,
  LOCAL_OPENAI_CONFIGURATION,
  READY_GEMINI_CONFIGURATION,
  READY_ZAI_CONFIGURATION,
  unconfiguredRow,
} from "@diffgazer/core/testing/provider-fixtures";
import { describe, expect, it } from "vitest";
import { getProviderActions } from "./actions";

// Configured rows cover the readiness states that drive different action rows; buildProviderRows
// adds an unconfigured placeholder row for every other selectable product.
const ROWS: ProviderListRow[] = buildProviderRows([
  configurationStatus(READY_GEMINI_CONFIGURATION, "ready"),
  configurationStatus(READY_ZAI_CONFIGURATION, "model-missing"),
  configurationStatus(LOCAL_OPENAI_CONFIGURATION, "local-endpoint-unreachable"),
  configurationStatus(CLI_UNSUPPORTED_CONFIGURATION, "unsupported"),
]);

function findRow(configurationId: string): ProviderListRow {
  const row = ROWS.find(
    (candidate) => candidate.configuration?.configurationId === configurationId,
  );
  if (!row) throw new Error(`Missing fixture row: ${configurationId}`);
  return row;
}

describe("getProviderActions", () => {
  it("never lists two actions running the same task in any provider state", () => {
    for (const row of ROWS) {
      const tasks = getProviderActions(row).map((action) => action.task);
      expect(new Set(tasks).size, `duplicate tasks for ${row.product.productId}`).toBe(
        tasks.length,
      );
    }
  });

  // Labels are presentation: rewording one must not change which buttons render, so the
  // dedup above reads the task identity each action carries.
  it("carries the task identity the de-duplication reads", () => {
    expect(getProviderActions(findRow("gemini-primary")).map((action) => action.task)).toEqual([
      "select-configuration",
      "update",
      "select",
      "delete",
    ]);
    expect(getProviderActions(findRow("zai-primary"))[0]).toMatchObject({ task: "select" });
    expect(getProviderActions(unconfiguredRow("openrouter"))[0]).toMatchObject({ task: "create" });
  });

  it("places the delete action last whenever it is available", () => {
    for (const row of ROWS) {
      const actions = getProviderActions(row);
      const deleteIndex = actions.findIndex((action) => action.id === "delete");
      if (deleteIndex === -1) continue;
      expect(deleteIndex).toBe(actions.length - 1);
      expect(actions[deleteIndex]?.intent).toBe("destructive");
    }
  });

  it("returns no actions without a selected row", () => {
    expect(getProviderActions(null)).toEqual([]);
  });

  it("offers a ready provider selection, setup, model, and delete", () => {
    const actions = getProviderActions(findRow("gemini-primary"));

    expect(actions.map((action) => action.id)).toEqual([
      "dispatch",
      "setup",
      "selectModel",
      "delete",
    ]);
    expect(actions[0]).toMatchObject({ label: "Select configuration", intent: "primary" });
    expect(actions[1]).toMatchObject({ label: "Update configuration", intent: "outline" });
    expect(actions[2]).toMatchObject({ label: "Select model", intent: "link" });
  });

  it("collapses setup into the dispatch task for an unconfigured provider", () => {
    const actions = getProviderActions(unconfiguredRow("openrouter"));

    expect(actions).toEqual([
      { id: "dispatch", task: "create", label: "Create configuration", intent: "primary" },
    ]);
  });

  it("drops the standalone model action when selecting a model is the dispatch task", () => {
    const actions = getProviderActions(findRow("zai-primary"));

    expect(actions[0]).toMatchObject({ id: "dispatch", label: "Select model" });
    expect(actions.filter((action) => action.id === "selectModel")).toEqual([]);
  });

  it("routes an unreachable local provider to its readiness task first", () => {
    const actions = getProviderActions(findRow("local-openai-1"));

    expect(actions[0]).toMatchObject({ id: "dispatch", label: "Test readiness" });
    expect(actions.some((action) => action.label === "Update configuration")).toBe(true);
  });

  it("routes a pending compatibility check to Test readiness first", () => {
    const rows = buildProviderRows([
      configurationStatus(READY_GEMINI_CONFIGURATION, "conformance-pending"),
    ]);
    const row = rows.find(
      (candidate) => candidate.configuration?.configurationId === "gemini-primary",
    );
    if (!row) throw new Error("Missing fixture row: gemini-primary");

    const actions = getProviderActions(row);

    expect(actions[0]).toEqual({
      id: "dispatch",
      task: "test",
      label: "Test readiness",
      intent: "primary",
    });
  });
});
