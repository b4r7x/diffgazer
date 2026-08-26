import { describe, expect, it } from "vitest";
import { HELP_SHORTCUTS, REVIEW_CONSENT_SHORTCUT } from "../schemas/presentation/shortcuts.js";
import {
  buildProviderRows,
  configurationStatus,
  GEMINI_CONFIGURATION,
  OPENROUTER_CONFIGURATION,
  unconfiguredRow,
  ZAI_CONFIGURATION,
} from "../testing/provider-fixtures.js";
import {
  findProviderHotkeyAction,
  getProviderActionHotkey,
  getProviderActionLayout,
  getProviderActionShortcuts,
  getProviderRowControls,
  getUnrecognizedConfigurationActionLayout,
  isConsentGatedProviderAction,
  PROVIDER_ACTION_HOTKEYS,
  type ProviderAction,
  type ProviderActionLayout,
} from "./action-layout.js";
import type { ProviderListRow } from "./list.js";

const ROWS: ProviderListRow[] = buildProviderRows([
  configurationStatus(GEMINI_CONFIGURATION, "ready"),
  configurationStatus(ZAI_CONFIGURATION, "model-missing"),
  configurationStatus(OPENROUTER_CONFIGURATION, "unsupported"),
]);

function findRow(configurationId: string): ProviderListRow {
  const row = ROWS.find(
    (candidate) => candidate.configuration?.configurationId === configurationId,
  );
  if (!row) throw new Error(`Missing fixture row: ${configurationId}`);
  return row;
}

function rowWithStatus(status: Parameters<typeof configurationStatus>[1]): ProviderListRow {
  const row = buildProviderRows([configurationStatus(GEMINI_CONFIGURATION, status)]).find(
    (candidate) => candidate.configuration?.configurationId === "gemini-primary",
  );
  if (!row) throw new Error(`Missing fixture row for ${status}`);
  return row;
}

function labels(actions: readonly (ProviderAction | null)[]): (string | null)[] {
  return actions.map((action) => action?.label ?? null);
}

function menuEntries(layout: ProviderActionLayout): string[] {
  return layout.overflow.map((action) =>
    action.disabledReason ? `${action.label} (${action.disabledReason})` : action.label,
  );
}

function everyAction(layout: ProviderActionLayout): ProviderAction[] {
  return [layout.primary, layout.secondary, ...layout.overflow].filter(
    (action): action is ProviderAction => action !== null,
  );
}

describe("getProviderActionLayout", () => {
  it("leads an unconfigured product with Configure and disables the whole menu with the reason", () => {
    const layout = getProviderActionLayout(unconfiguredRow("openrouter"), null);

    expect(layout.active).toBe(false);
    expect(layout.primary).toEqual({ id: "dispatch", task: "create", label: "Configure" });
    expect(layout.secondary).toBeNull();
    expect(menuEntries(layout)).toEqual([
      "Update configuration (Configure this provider first)",
      "Verify (Configure this provider first)",
      "Select model (Configure this provider first)",
      "Delete configuration (Configure this provider first)",
    ]);
  });

  it("leads a keyed configuration without a model with Select model beside Update configuration", () => {
    const layout = getProviderActionLayout(findRow("zai-primary"), null);

    expect(labels([layout.primary, layout.secondary])).toEqual([
      "Select model",
      "Update configuration",
    ]);
    expect(layout.primary).toMatchObject({ id: "dispatch", task: "select" });
    expect(menuEntries(layout)).toEqual(["Verify (Select model first)", "Delete configuration"]);
  });

  it("leads a ready, inactive configuration with Select configuration beside Change model", () => {
    const layout = getProviderActionLayout(findRow("gemini-primary"), null);

    expect(layout.active).toBe(false);
    expect(layout.primary).toEqual({
      id: "selectConfiguration",
      task: "select-configuration",
      label: "Select configuration",
    });
    expect(layout.secondary).toEqual({ id: "selectModel", task: "select", label: "Change model" });
    expect(menuEntries(layout)).toEqual(["Update configuration", "Verify", "Delete configuration"]);
  });

  it("drops the primary for the active configuration and keeps Change model beside the menu", () => {
    const layout = getProviderActionLayout(findRow("gemini-primary"), "gemini-primary");

    expect(layout.active).toBe(true);
    expect(layout.primary).toBeNull();
    expect(layout.secondary).toMatchObject({ label: "Change model" });
    expect(menuEntries(layout)).toEqual(["Update configuration", "Verify", "Delete configuration"]);
  });

  it("selects an unverified configuration first and keeps Verify optional in the menu", () => {
    const layout = getProviderActionLayout(rowWithStatus("conformance-pending"), null);

    expect(layout.primary).toMatchObject({ id: "selectConfiguration" });
    expect(layout.overflow.find((action) => action.id === "verify")).toEqual({
      id: "verify",
      task: "test",
      label: "Verify",
    });
  });

  it("keeps the readiness remediation as the primary even for the active configuration", () => {
    const layout = getProviderActionLayout(rowWithStatus("credential-invalid"), "gemini-primary");

    expect(layout.active).toBe(true);
    expect(layout.primary).toEqual({
      id: "dispatch",
      task: "update",
      label: "Update configuration",
    });
    expect(layout.secondary).toMatchObject({ label: "Change model" });
    expect(menuEntries(layout)).toEqual([
      "Verify (Update configuration first)",
      "Delete configuration",
    ]);
  });

  it("leads a failed verification with Verify and never lists Verify twice", () => {
    const rows = [rowWithStatus("conformance-failed"), rowWithStatus("skipped")];
    for (const row of rows) {
      const status = row.readiness.status;
      const layout = getProviderActionLayout(row, null);

      expect(layout.primary, status).toMatchObject({
        id: "dispatch",
        task: "test",
        label: "Verify",
      });
      expect(
        everyAction(layout).filter((action) => action.task === "test"),
        status,
      ).toHaveLength(1);
      expect(menuEntries(layout), status).toEqual(["Update configuration", "Delete configuration"]);
    }
  });

  it("routes an unsupported configuration to inspection first", () => {
    const layout = getProviderActionLayout(findRow("openrouter-1"), null);

    expect(layout.primary).toMatchObject({ task: "inspect", label: "Inspect configuration" });
    expect(layout.overflow.find((action) => action.id === "verify")).toMatchObject({
      disabledReason: "Inspect configuration first",
    });
  });

  it("disables selection with its reason when the row cannot be selected", () => {
    const layout = getProviderActionLayout(
      { ...findRow("gemini-primary"), actions: ["inspect", "test", "update", "delete"] },
      null,
    );

    expect(layout.primary).toMatchObject({
      label: "Select configuration",
      disabledReason: "Selection is not available",
    });
    expect(layout.secondary).toMatchObject({ label: "Update configuration" });
    expect(layout.overflow.find((action) => action.id === "selectModel")).toMatchObject({
      disabledReason: "Model selection is not available",
    });
  });

  it("never lists one task twice and always ends the menu with the destructive action", () => {
    for (const row of [
      ...ROWS,
      rowWithStatus("conformance-pending"),
      rowWithStatus("credential-invalid"),
    ]) {
      for (const activeId of [null, row.configuration?.configurationId ?? null]) {
        const layout = getProviderActionLayout(row, activeId);
        const tasks = everyAction(layout).map((action) => action.task);

        expect(new Set(tasks).size, `${row.product.productId}/${activeId}`).toBe(tasks.length);
        expect(layout.overflow.at(-1)?.id, `${row.product.productId}/${activeId}`).toBe("delete");
        expect(getProviderRowControls(layout).length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("derives an empty layout and no controls without a row", () => {
    const layout = getProviderActionLayout(null, null);

    expect(layout).toEqual({ active: false, primary: null, secondary: null, overflow: [] });
    expect(getProviderRowControls(layout)).toEqual([]);
  });
});

describe("getUnrecognizedConfigurationActionLayout", () => {
  it("offers removal alone behind the menu and explains every other entry", () => {
    const layout = getUnrecognizedConfigurationActionLayout();

    expect(getProviderRowControls(layout)).toEqual([{ id: "more", label: "More" }]);
    expect(menuEntries(layout)).toEqual([
      "Update configuration (Only removal is available)",
      "Verify (Only removal is available)",
      "Select model (Only removal is available)",
      "Delete configuration",
    ]);
  });
});

describe("getProviderRowControls", () => {
  it("renders primary, secondary, then the More trigger", () => {
    const layout = getProviderActionLayout(findRow("gemini-primary"), null);

    expect(getProviderRowControls(layout).map((control) => control.id)).toEqual([
      "selectConfiguration",
      "selectModel",
      "more",
    ]);
  });
});

describe("isConsentGatedProviderAction", () => {
  it.each([
    ["select-configuration", true],
    ["create", true],
    ["update", true],
    ["test", true],
    ["select", false],
    ["inspect", false],
    ["delete", false],
  ] as const)("gates the %s task: %s", (task, gated) => {
    expect(isConsentGatedProviderAction({ id: "dispatch", task, label: task })).toBe(gated);
  });
});

describe("provider action hotkeys", () => {
  it("reach their action wherever the state placed it", () => {
    const noModel = getProviderActionLayout(findRow("zai-primary"), null);
    expect(findProviderHotkeyAction(noModel, "m")).toBe(noModel.primary);
    expect(findProviderHotkeyAction(noModel, "e")).toBe(noModel.secondary);
    expect(findProviderHotkeyAction(noModel, "v")).toBeNull();
    expect(findProviderHotkeyAction(noModel, "d")).toMatchObject({ id: "delete" });

    const unconfigured = getProviderActionLayout(unconfiguredRow("openrouter"), null);
    expect(findProviderHotkeyAction(unconfigured, "e")).toBe(unconfigured.primary);
    expect(findProviderHotkeyAction(unconfigured, "d")).toBeNull();
  });

  it("advertise only the keys the layout can run", () => {
    expect(
      getProviderActionShortcuts(getProviderActionLayout(findRow("gemini-primary"), null)),
    ).toEqual([
      { key: "m", label: "Model" },
      { key: "e", label: "Edit" },
      { key: "v", label: "Verify" },
      { key: "d", label: "Delete" },
    ]);
    expect(
      getProviderActionShortcuts(getProviderActionLayout(findRow("zai-primary"), null)),
    ).toEqual([
      { key: "m", label: "Model" },
      { key: "e", label: "Edit" },
      { key: "d", label: "Delete" },
    ]);
    expect(
      getProviderActionShortcuts(getProviderActionLayout(unconfiguredRow("openrouter"), null)),
    ).toEqual([{ key: "e", label: "Edit" }]);
  });

  it("label each menu entry with the key it answers to", () => {
    const layout = getProviderActionLayout(findRow("gemini-primary"), null);

    expect(layout.overflow.map(getProviderActionHotkey)).toEqual(["e", "v", "d"]);
  });

  it("are the keys the shared help table teaches for the Providers page", () => {
    expect(
      HELP_SHORTCUTS.filter((shortcut) => shortcut.context === "providers").map(({ key }) => key),
    ).toEqual([...PROVIDER_ACTION_HOTKEYS.map(({ key }) => key), REVIEW_CONSENT_SHORTCUT.key]);
  });
});
