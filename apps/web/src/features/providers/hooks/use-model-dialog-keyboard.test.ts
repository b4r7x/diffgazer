import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { createElement, useRef, useState, type ReactNode } from "react";
import type { TierFilter } from "@/features/providers/constants";
import { ModelFilterTabs } from "@/features/providers/components/model-select-dialog/model-filter-tabs";
import { useModelDialogKeyboard } from "./use-model-dialog-keyboard";

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

  render(createElement(
    KeyboardProvider,
    null,
    createElement(TestModelDialogKeyboard, { models, currentModel, onSelect, onOpenChange }),
  ));

  return { user, onSelect, onOpenChange };
}

function TestInteractiveModelDialogKeyboard({
  onTierFilter,
}: {
  onTierFilter: (filter: TierFilter) => void;
}) {
  const models = [makeModel("model-a"), makeModel("model-b")];
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const applyTierFilter = (nextFilter: TierFilter) => {
    setTierFilter(nextFilter);
    onTierFilter(nextFilter);
  };
  const keyboard = useModelDialogKeyboard({
    open: true,
    currentModel: undefined,
    models,
    filteredModels: models,
    searchQuery,
    setSearchQuery,
    cycleTierFilter: vi.fn(),
    resetFilters: vi.fn(),
    searchInputRef,
    listContainerRef,
    onSelect: vi.fn(),
    onOpenChange: vi.fn(),
  });

  return createElement(
    "div",
    null,
    createElement("input", {
      "aria-label": "Search models",
      ref: searchInputRef,
      value: searchQuery,
      onChange: (event) => setSearchQuery((event.target as HTMLInputElement).value),
      onFocus: () => keyboard.setFocusZone("search"),
    }),
    createElement(ModelFilterTabs, {
      value: tierFilter,
      onChange: applyTierFilter,
      focusedIndex: keyboard.filterIndex,
      isFocused: keyboard.focusZone === "filters",
      onTabClick: (index) => {
        keyboard.setFocusZone("filters");
        keyboard.setFilterIndex(index);
      },
      onKeyDown: keyboard.handleFilterKeyDown,
      getTabProps: keyboard.getFilterButtonProps,
    }),
    createElement(
      "div",
      { ref: listContainerRef, role: "radiogroup" },
      ...models.map((model) =>
        createElement("div", {
          key: model.id,
          role: "radio",
          "data-value": model.id,
          tabIndex: 0,
        }, model.name),
      ),
    ),
  );
}

function renderInteractiveSubject(onTierFilter = vi.fn()) {
  const user = userEvent.setup();

  render(createElement(
    KeyboardProvider,
    null,
    createElement(TestInteractiveModelDialogKeyboard, { onTierFilter }),
  ));

  return { user, onTierFilter };
}

describe("useModelDialogKeyboard", () => {
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
    const { user, onSelect, onOpenChange } = renderDialogSubject([makeModel("visible-model")], "stale-model");

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onSelect).toHaveBeenCalledWith("visible-model");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("focuses model search with slash without typing slash into the field", async () => {
    const { user } = renderInteractiveSubject();

    await user.keyboard("/");

    const search = screen.getByRole("textbox", { name: /search models/i });
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");
  });

  it("changes tier filters through ModelFilterTabs roving controls", async () => {
    const onTierFilter = vi.fn();
    const { user } = renderInteractiveSubject(onTierFilter);

    await user.keyboard("/");
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: "all" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");

    const freeFilter = screen.getByRole("radio", { name: "free" });
    expect(freeFilter).toHaveFocus();
    expect(freeFilter).toHaveAttribute("aria-checked", "true");
    expect(onTierFilter).toHaveBeenCalledWith("free");
  });
});
