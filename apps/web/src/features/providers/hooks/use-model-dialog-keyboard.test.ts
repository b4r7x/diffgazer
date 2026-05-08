import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { createElement, type ReactNode } from "react";
import { useModelDialogKeyboard } from "./use-model-dialog-keyboard";

function makeModel(id: string): ModelInfo {
  return {
    id,
    name: id,
    description: `${id} description`,
    tier: "paid",
  };
}

function renderSubject(models: ModelInfo[]) {
  const listContainer = document.createElement("div");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(KeyboardProvider, null, children);

  return renderHook(
    ({ nextModels }: { nextModels: ModelInfo[] }) =>
      useModelDialogKeyboard({
        open: true,
        currentModel: undefined,
        models: nextModels,
        filteredModels: nextModels,
        searchQuery: "",
        setSearchQuery: vi.fn(),
        setTierFilter: vi.fn(),
        cycleTierFilter: vi.fn(),
        resetFilters: vi.fn(),
        searchInputRef: { current: null },
        listContainerRef: { current: listContainer },
        onSelect: vi.fn(),
        onOpenChange: vi.fn(),
      }),
    { initialProps: { nextModels: models }, wrapper },
  );
}

describe("useModelDialogKeyboard", () => {
  it("focuses the first available model when models load after the dialog opens", async () => {
    const { result, rerender } = renderSubject([]);

    expect(result.current.focusedModelId).toBeNull();

    rerender({ nextModels: [makeModel("model-a"), makeModel("model-b")] });

    await waitFor(() => {
      expect(result.current.focusedModelId).toBe("model-a");
    });
  });
});
