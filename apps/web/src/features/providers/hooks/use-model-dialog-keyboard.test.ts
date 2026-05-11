import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { createElement, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

const DEFAULT_INTERACTIVE_MODELS = [makeModel("model-a"), makeModel("model-b")];

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

function TestModelFooterKeyboard({
  models,
  filteredModels = models,
  onSelect,
  onOpenChange,
}: {
  models: ModelInfo[];
  filteredModels?: ModelInfo[];
  onSelect: (modelId: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const keyboard = useModelDialogKeyboard({
    open: true,
    currentModel: undefined,
    models,
    filteredModels,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    cycleTierFilter: vi.fn(),
    resetFilters: vi.fn(),
    searchInputRef,
    listContainerRef,
    onSelect,
    onOpenChange,
  });
  const cancelProps = keyboard.getFooterButtonProps(0);
  const confirmProps = keyboard.getFooterButtonProps(1);

  return createElement(
    "div",
    null,
    createElement("input", { "aria-label": "Search models", ref: searchInputRef }),
    createElement(
      "div",
      { ref: listContainerRef, role: "radiogroup" },
      ...filteredModels.map((model) =>
        createElement("div", {
          key: model.id,
          role: "radio",
          "data-value": model.id,
          tabIndex: 0,
        }, model.name),
      ),
    ),
    createElement("button", {
      type: "button",
      ref: cancelProps.ref,
      onFocus: cancelProps.onFocus,
      onClick: () => keyboard.handleCancel(),
    }, "Cancel"),
    createElement("button", {
      type: "button",
      ref: confirmProps.ref,
      onFocus: confirmProps.onFocus,
      onClick: () => keyboard.handleConfirm(),
      disabled: filteredModels.length === 0,
    }, "Confirm"),
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

function renderFooterSubject(models: ModelInfo[], filteredModels = models) {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();

  const view = render(createElement(
    KeyboardProvider,
    null,
    createElement(TestModelFooterKeyboard, { models, filteredModels, onSelect, onOpenChange }),
  ));

  const rerenderFooterSubject = (nextFilteredModels: ModelInfo[]) => {
    view.rerender(createElement(
      KeyboardProvider,
      null,
      createElement(TestModelFooterKeyboard, {
        models,
        filteredModels: nextFilteredModels,
        onSelect,
        onOpenChange,
      }),
    ));
  };

  return { rerenderFooterSubject, user, onSelect, onOpenChange };
}

function TestInteractiveModelDialogKeyboard({
  onTierFilter,
  focusCloseDuringOpen = false,
  currentModel,
  models = DEFAULT_INTERACTIVE_MODELS,
}: {
  onTierFilter: (filter: TierFilter) => void;
  focusCloseDuringOpen?: boolean;
  currentModel?: string;
  models?: ModelInfo[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const applyTierFilter = (nextFilter: TierFilter) => {
    setTierFilter(nextFilter);
    onTierFilter(nextFilter);
  };
  const keyboard = useModelDialogKeyboard({
    open: true,
    currentModel,
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
  const closeButtonProps = keyboard.getCloseButtonProps();
  const cancelProps = keyboard.getFooterButtonProps(0);
  const confirmProps = keyboard.getFooterButtonProps(1);

  useLayoutEffect(() => {
    if (focusCloseDuringOpen) closeButtonRef.current?.focus();
  }, [focusCloseDuringOpen]);

  return createElement(
    "div",
    null,
    createElement("button", {
      type: "button",
      ref: (node: HTMLButtonElement | null) => {
        closeButtonRef.current = node;
        closeButtonProps.ref(node);
      },
      onFocus: closeButtonProps.onFocus,
    }, "Close"),
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
    createElement("button", {
      type: "button",
      ref: cancelProps.ref,
      onFocus: cancelProps.onFocus,
    }, "Cancel"),
    createElement("button", {
      type: "button",
      ref: confirmProps.ref,
      onFocus: confirmProps.onFocus,
      disabled: models.length === 0,
    }, "Confirm"),
  );
}

function renderInteractiveSubject(
  onTierFilter = vi.fn(),
  options: { focusCloseDuringOpen?: boolean; currentModel?: string; models?: ModelInfo[] } = {},
) {
  const user = userEvent.setup();

  render(createElement(
    KeyboardProvider,
    null,
    createElement(TestInteractiveModelDialogKeyboard, { onTierFilter, ...options }),
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

  it("keeps footer focus on cancel when confirm is disabled", async () => {
    const { user, onSelect, onOpenChange } = renderFooterSubject([]);

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    await user.click(cancel);

    expect(cancel).toHaveFocus();
    expect(confirm).toBeDisabled();

    await user.keyboard("{ArrowRight}");

    expect(cancel).toHaveFocus();
    expect(confirm).not.toHaveFocus();

    await user.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("repairs footer focus when the filtered model list becomes empty", async () => {
    const visibleModel = makeModel("visible-model");
    const { rerenderFooterSubject, user, onSelect, onOpenChange } = renderFooterSubject([visibleModel]);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "visible-model" })).toHaveFocus();
    });

    await user.keyboard("j");
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();

    rerenderFooterSubject([]);

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(confirm).toBeDisabled();

    await user.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
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

  it("moves from model search to the close button with ArrowUp and back with ArrowDown", async () => {
    const { user } = renderInteractiveSubject();

    await user.keyboard("/");
    await user.keyboard("{ArrowUp}");

    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("textbox", { name: /search models/i })).toHaveFocus();
  });

  it("moves from a directly focused close button back to model search with ArrowDown", async () => {
    const { user } = renderInteractiveSubject();

    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);

    expect(closeButton).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("textbox", { name: /search models/i })).toHaveFocus();
  });

  it("moves from a directly focused close button back to search when no models are focusable", async () => {
    const { user } = renderInteractiveSubject(vi.fn(), { models: [] });

    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);

    expect(closeButton).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("textbox", { name: /search models/i })).toHaveFocus();
  });

  it("moves from model filters to cancel when no models are focusable", async () => {
    const { user } = renderInteractiveSubject(vi.fn(), { models: [] });

    await user.keyboard("/");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "all" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("restores native close focus during open to the current model", async () => {
    renderInteractiveSubject(vi.fn(), {
      currentModel: "model-b",
      focusCloseDuringOpen: true,
    });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "model-b" })).toHaveFocus();
    });
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveFocus();
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
