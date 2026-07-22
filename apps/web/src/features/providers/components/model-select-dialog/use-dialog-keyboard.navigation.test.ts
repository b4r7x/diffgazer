import type { TierFilter } from "@diffgazer/core/providers";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useLayoutEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ModelFilterTabs } from "./filter-tabs";
import { useModelDialogKeyboard } from "./use-dialog-keyboard";

function makeModel(id: string): ModelInfo {
  return {
    id,
    name: id,
    description: `${id} description`,
    tier: "paid",
  };
}

const DEFAULT_INTERACTIVE_MODELS = [makeModel("model-a"), makeModel("model-b")];

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
    createElement(
      "button",
      {
        type: "button",
        ref: (node: HTMLButtonElement | null) => {
          closeButtonRef.current = node;
          closeButtonProps.ref(node);
        },
        onFocus: closeButtonProps.onFocus,
      },
      "Close",
    ),
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
    ),
    createElement(
      "button",
      {
        type: "button",
        ref: cancelProps.ref,
        onFocus: cancelProps.onFocus,
      },
      "Cancel",
    ),
    createElement(
      "button",
      {
        type: "button",
        ref: confirmProps.ref,
        onFocus: confirmProps.onFocus,
        disabled: models.length === 0,
      },
      "Confirm",
    ),
  );
}

function renderInteractiveSubject(
  onTierFilter = vi.fn(),
  options: { focusCloseDuringOpen?: boolean; currentModel?: string; models?: ModelInfo[] } = {},
) {
  const user = userEvent.setup();

  render(
    createElement(
      KeyboardProvider,
      null,
      createElement(TestInteractiveModelDialogKeyboard, { onTierFilter, ...options }),
    ),
  );

  return { user, onTierFilter };
}

describe("useModelDialogKeyboard navigation", () => {
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
