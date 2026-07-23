import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";

const apiMocks = vi.hoisted(() => ({
  settings: {
    theme: "dark",
    defaultLenses: ["security", "performance", "simplicity", "tests"],
    defaultProfile: null,
    severityThreshold: "medium",
    secretsStorage: "keyring",
    agentExecution: "sequential",
  } as SettingsConfig,
  saveFailure: null as string | null,
  mutate: vi.fn(),
}));

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useInit: () => ({
      data: {
        configured: true,
        config: { provider: "openrouter", model: "test-model" },
        project: { projectId: "project-1", path: "/work/project", trust: null },
      },
      error: null,
      isLoading: false,
    }),
    useSaveSettings: () => ({
      error: null,
      isPending: false,
      mutate: apiMocks.mutate,
    }),
    useSettings: () => ({ data: apiMocks.settings, error: null, isLoading: false }),
    useTrustEditor: (_input: unknown, callbacks: { onError: (message: string) => void }) => ({
      capabilities: { readFiles: true, runCommands: false },
      isTrusted: true,
      isLoading: false,
      isSaving: false,
      isRevoking: false,
      handleCapabilitiesChange: vi.fn(),
      handleSave: () => callbacks.onError("trust save \u001b[31mfailed\u001b[0m"),
      handleRevoke: vi.fn(),
    }),
  };
});

import { AnalysisScreen } from "./analysis-screen";
import { StorageScreen } from "./storage-screen";
import { ThemeScreen } from "./theme-screen";
import { TrustPermissionsScreen } from "./trust-permissions-screen";

async function press(view: ReturnType<typeof renderRootFrame>, input: string): Promise<void> {
  view.stdin.write(input);
  await new Promise((resolve) => setImmediate(resolve));
}

function expectWithinTerminal(frame: string): void {
  expect(frame.split("\n")).toHaveLength(24);
}

beforeEach(() => {
  apiMocks.settings.secretsStorage = "keyring";
  apiMocks.saveFailure = null;
  apiMocks.mutate.mockImplementation(
    (
      _settings: unknown,
      callbacks?: { onError?: (error: Error) => void; onSuccess?: () => void },
    ) => {
      if (apiMocks.saveFailure) {
        callbacks?.onError?.(new Error(apiMocks.saveFailure));
        return;
      }
      callbacks?.onSuccess?.();
    },
  );
});

afterEach(() => {
  cleanupRootFrames();
  vi.clearAllMocks();
});

describe("settings screens at the 80x24 support floor", () => {
  test("keeps a theme preview visible and saves the already-selected theme with Enter", async () => {
    const view = renderRootFrame(80, 24, <ThemeScreen />);

    await vi.waitFor(() => expect(view.lastFrame()).toContain("Live Preview:"));
    expect(view.lastFrame()).toContain("■ green");
    await press(view, "\r");

    await vi.waitFor(() => {
      expect(apiMocks.mutate).toHaveBeenCalledWith({ theme: "dark" }, expect.any(Object));
    });
    expectWithinTerminal(view.lastFrame() ?? "");
  });

  test("keeps a storage save failure visible above the actions", async () => {
    apiMocks.saveFailure = "storage save failed";
    const view = renderRootFrame(80, 24, <StorageScreen />);

    await press(view, "\u001B[A");
    await press(view, "\r");
    await press(view, "\t");
    await press(view, "\u001B[C");
    await press(view, "\r");

    await vi.waitFor(() => expect(view.lastFrame()).toContain("storage save failed"));
    const frame = view.lastFrame() ?? "";
    expect(frame.indexOf("storage save failed")).toBeLessThan(frame.indexOf("Cancel"));
    expectWithinTerminal(frame);
  });

  test("keeps fresh storage settings unselected with Save disabled", async () => {
    apiMocks.settings.secretsStorage = null;
    const view = renderRootFrame(80, 24, <StorageScreen />);

    await vi.waitFor(() => expect(view.lastFrame()).toContain("CONFIGURE SECRETS STORAGE"));
    expect(view.lastFrame()).not.toContain("( * )");

    await press(view, "\t");
    await press(view, "\u001B[C");
    await press(view, "\r");
    expect(apiMocks.mutate).not.toHaveBeenCalled();
  });

  test("keeps a trust save failure visible above the actions", async () => {
    const view = renderRootFrame(80, 24, <TrustPermissionsScreen />);

    await press(view, "\t");
    await press(view, "\r");

    await vi.waitFor(() => expect(view.lastFrame()).toContain("trust save failed"));
    const frame = view.lastFrame() ?? "";
    expect(frame.indexOf("trust save failed")).toBeLessThan(frame.indexOf("Save Changes"));
    expectWithinTerminal(frame);
  });

  test("keeps an analysis save failure visible above the actions", async () => {
    apiMocks.saveFailure = "analysis save failed";
    const view = renderRootFrame(80, 24, <AnalysisScreen />);

    await press(view, " ");
    await press(view, "\t");
    await press(view, "\u001B[C");
    await press(view, "\r");

    await vi.waitFor(() => expect(view.lastFrame()).toContain("analysis save failed"));
    const frame = view.lastFrame() ?? "";
    expect(frame.indexOf("analysis save failed")).toBeLessThan(frame.indexOf("Cancel"));
    expectWithinTerminal(frame);
  });
});
