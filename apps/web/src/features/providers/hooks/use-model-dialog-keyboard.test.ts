import { describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function renderSubject(models: ModelInfo[], currentModel?: string) {
  const listContainer = document.createElement("div");
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(KeyboardProvider, null, children);

  const hook = renderHook(
    ({ nextModels }: { nextModels: ModelInfo[] }) =>
      useModelDialogKeyboard({
        open: true,
        currentModel,
        models: nextModels,
        filteredModels: nextModels,
        searchQuery: "",
        setSearchQuery: vi.fn(),
        setTierFilter: vi.fn(),
        cycleTierFilter: vi.fn(),
        resetFilters: vi.fn(),
        searchInputRef: { current: null },
        listContainerRef: { current: listContainer },
        onSelect,
        onOpenChange,
      }),
    { initialProps: { nextModels: models }, wrapper },
  );
  return { ...hook, onSelect, onOpenChange };
}

function TestModelDialogKeyboard({
  models,
  currentModel,
  onSelect,
  onOpenChange,
}: {
  models: ModelInfo[];
  currentModel?: string;
  onSelect: (modelId: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const listContainer = document.createElement("div");
  const keyboard = useModelDialogKeyboard({
    open: true,
    currentModel,
    models,
    filteredModels: models,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    setTierFilter: vi.fn(),
    cycleTierFilter: vi.fn(),
    resetFilters: vi.fn(),
    searchInputRef: { current: null },
    listContainerRef: { current: listContainer },
    onSelect,
    onOpenChange,
  });

  return createElement(
    "div",
    null,
    ...models.map((model) =>
      createElement(
        "div",
        {
          key: model.id,
          role: "radio",
          "aria-checked": keyboard.checkedModelId === model.id,
        },
        model.name,
      ),
    ),
    createElement("button", { type: "button", onClick: () => keyboard.handleConfirm() }, "Confirm"),
  );
}

function renderDialogSubject(models: ModelInfo[], currentModel?: string) {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();

  render(createElement(
    KeyboardProvider,
    null,
    createElement(TestModelDialogKeyboard, { models, currentModel, onSelect, onOpenChange }),
  ));

  return { user, onSelect, onOpenChange };
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

  it("does not confirm a stale checked model when the filtered list is empty", async () => {
    const { user, onSelect, onOpenChange } = renderDialogSubject([], "stale-model");

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("confirms the first filtered model when checked and focused models are stale", async () => {
    const { user, onSelect, onOpenChange } = renderDialogSubject([makeModel("visible-model")], "stale-model");

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenCalledWith("visible-model");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
