import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useModelDialogKeyboard } from "./use-dialog-keyboard";

function makeModel(id: string): ModelInfo {
  return {
    id,
    name: id,
    description: `${id} description`,
    tier: "paid",
  };
}

function TestLazyLoadModelList({ models }: { models: ModelInfo[] }) {
  const listContainerRef = useRef<HTMLDivElement>(null);
  useModelDialogKeyboard({
    open: true,
    currentModel: undefined,
    models,
    filteredModels: models,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    cycleTierFilter: vi.fn(),
    resetFilters: vi.fn(),
    searchInputRef: { current: null },
    listContainerRef,
    onSelect: vi.fn(),
    onOpenChange: vi.fn(),
  });

  return createElement(
    "div",
    { ref: listContainerRef, role: "radiogroup" },
    ...models.map((model) =>
      createElement(
        "div",
        {
          key: model.id,
          role: "radio",
          "data-value": model.id,
          tabIndex: 0,
        },
        model.name,
      ),
    ),
  );
}

function renderLazyLoadSubject(models: ModelInfo[]) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(KeyboardProvider, null, children);
  }
  return render(createElement(TestLazyLoadModelList, { models }), { wrapper: Wrapper });
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

  render(
    createElement(
      KeyboardProvider,
      null,
      createElement(TestModelDialogKeyboard, { models, currentModel, onSelect, onOpenChange }),
    ),
  );

  return { user, onSelect, onOpenChange };
}

describe("useModelDialogKeyboard selection", () => {
  it("focuses the first available model when models load after the dialog opens", async () => {
    const { rerender } = renderLazyLoadSubject([]);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    rerender(
      createElement(
        KeyboardProvider,
        null,
        createElement(TestLazyLoadModelList, {
          models: [makeModel("model-a"), makeModel("model-b")],
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "model-a" })).toHaveFocus();
    });
  });

  it("does not confirm a stale checked model when the filtered list is empty", async () => {
    const { user, onSelect, onOpenChange } = renderDialogSubject([], "stale-model");

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("confirms the first filtered model when checked and focused models are stale", async () => {
    const { user, onSelect, onOpenChange } = renderDialogSubject(
      [makeModel("visible-model")],
      "stale-model",
    );

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenCalledWith("visible-model");
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
