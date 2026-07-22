import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useRef } from "react";
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

function TestModelFooterKeyboard({
  models,
  filteredModels = models,
  isSaving = false,
  onSelect,
  onOpenChange,
}: {
  models: ModelInfo[];
  filteredModels?: ModelInfo[];
  isSaving?: boolean;
  onSelect: (modelId: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const keyboard = useModelDialogKeyboard({
    open: true,
    isSaving,
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
      ...(isSaving ? [] : filteredModels).map((model) =>
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
        disabled: isSaving,
      },
      "Cancel",
    ),
    createElement(
      "button",
      {
        type: "button",
        ref: confirmProps.ref,
        onFocus: confirmProps.onFocus,
        onClick: () => keyboard.handleConfirm(),
        disabled: isSaving || filteredModels.length === 0,
      },
      "Confirm",
    ),
  );
}

function renderFooterSubject(models: ModelInfo[], filteredModels = models, isSaving = false) {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();

  const view = render(
    createElement(
      KeyboardProvider,
      null,
      createElement(TestModelFooterKeyboard, {
        models,
        filteredModels,
        isSaving,
        onSelect,
        onOpenChange,
      }),
    ),
  );

  const rerenderFooterSubject = (nextFilteredModels: ModelInfo[], nextIsSaving = isSaving) => {
    view.rerender(
      createElement(
        KeyboardProvider,
        null,
        createElement(TestModelFooterKeyboard, {
          models,
          filteredModels: nextFilteredModels,
          isSaving: nextIsSaving,
          onSelect,
          onOpenChange,
        }),
      ),
    );
  };

  return { rerenderFooterSubject, user, onSelect, onOpenChange };
}

describe("useModelDialogKeyboard footer focus", () => {
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
    const { rerenderFooterSubject, user, onSelect, onOpenChange } = renderFooterSubject([
      visibleModel,
    ]);

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

  it("repairs footer focus when saving ends after the filtered list emptied", async () => {
    const visibleModel = makeModel("visible-model");
    const { rerenderFooterSubject } = renderFooterSubject([visibleModel]);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "visible-model" })).toHaveFocus();
    });

    rerenderFooterSubject([visibleModel], true);
    rerenderFooterSubject([], true);

    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toBeDisabled();
    expect(cancel).not.toHaveFocus();

    rerenderFooterSubject([], false);

    await waitFor(() => expect(cancel).toHaveFocus());
    expect(cancel).not.toBeDisabled();
  });

  it("does not repair list focus on a parent rerender with identical filtered results", async () => {
    const visibleModel = makeModel("visible-model");
    const { rerenderFooterSubject } = renderFooterSubject([visibleModel]);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "visible-model" })).toHaveFocus();
    });

    // Focus drifts off the list without leaving the list zone.
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.body).toHaveFocus();

    // Re-render with the SAME filtered ids: the focus-repair effect must not re-fire.
    rerenderFooterSubject([visibleModel]);

    expect(document.body).toHaveFocus();
    expect(screen.getByRole("radio", { name: "visible-model" })).not.toHaveFocus();
  });

  it("repairs list focus when the filtered id set changes", async () => {
    const visibleModel = makeModel("visible-model");
    const { rerenderFooterSubject } = renderFooterSubject([visibleModel]);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "visible-model" })).toHaveFocus();
    });

    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.body).toHaveFocus();

    // A different filtered id set re-fires the repair effect and re-establishes list focus.
    rerenderFooterSubject([makeModel("other-model")]);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "other-model" })).toHaveFocus();
    });
  });
});
