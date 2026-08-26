import type { TierFilter } from "@diffgazer/core/providers";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, render, screen, waitFor } from "@testing-library/react";
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

interface InteractiveSubjectOptions {
  onTierFilter: (filter: TierFilter) => void;
  focusCloseDuringOpen?: boolean;
  focusSearchDuringOpen?: boolean;
  currentModel?: string;
  models?: ModelInfo[];
  discoveryStatus?: "loading" | "passed" | "error";
  /** Mirrors the dialog's discovery-warning callout: renders a Retry button between the filter row and the list. */
  retryVisible?: boolean;
  onRetry?: () => void;
  /** Exposes the hook result so tests can drive the RadioGroup boundary path. */
  captureKeyboard?: (keyboard: ReturnType<typeof useModelDialogKeyboard>) => void;
}

function TestInteractiveModelDialogKeyboard({
  onTierFilter,
  focusCloseDuringOpen = false,
  focusSearchDuringOpen = false,
  currentModel,
  models = DEFAULT_INTERACTIVE_MODELS,
  discoveryStatus,
  retryVisible = false,
  onRetry,
  captureKeyboard,
}: InteractiveSubjectOptions) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const resolvedDiscoveryStatus = discoveryStatus ?? (models.length > 0 ? "passed" : "error");
  const applyTierFilter = (nextFilter: TierFilter) => {
    setTierFilter(nextFilter);
    onTierFilter(nextFilter);
  };
  const keyboard = useModelDialogKeyboard({
    open: true,
    currentModel,
    models,
    filteredModels: models,
    discoveryStatus: resolvedDiscoveryStatus,
    retryVisible,
    cycleTierFilter: vi.fn(),
    resetFilters: vi.fn(),
    searchInputRef,
    listContainerRef,
    onSelect: vi.fn(),
    onOpenChange: vi.fn(),
  });
  captureKeyboard?.(keyboard);
  const closeButtonProps = keyboard.getCloseButtonProps();
  const retryProps = keyboard.getRetryButtonProps();
  const cancelProps = keyboard.getFooterButtonProps(0);
  const confirmProps = keyboard.getFooterButtonProps(1);

  useLayoutEffect(() => {
    if (focusCloseDuringOpen) closeButtonRef.current?.focus();
    if (focusSearchDuringOpen) searchInputRef.current?.focus();
  }, [focusCloseDuringOpen, focusSearchDuringOpen]);

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
      onFocus: keyboard.handleSearchFocus,
    }),
    createElement(ModelFilterTabs, {
      value: tierFilter,
      onChange: applyTierFilter,
      focusedIndex: keyboard.filterIndex,
      isFocused: keyboard.focusZone === "filters",
      onKeyDown: keyboard.handleFilterKeyDown,
      getTabProps: keyboard.getFilterButtonProps,
      // Mirrors the dialog: the tier row is disabled unless discovery passed.
      disabled: resolvedDiscoveryStatus !== "passed",
    }),
    retryVisible
      ? createElement(
          "button",
          {
            type: "button",
            ref: retryProps.ref,
            onFocus: retryProps.onFocus,
            onClick: onRetry,
          },
          "Retry",
        )
      : null,
    // Mirrors the dialog: the container ref sits on the scroll wrapper while
    // the rows' owning radiogroup is nested inside it.
    createElement(
      "div",
      { ref: listContainerRef },
      createElement(
        "div",
        { role: "radiogroup", "aria-label": "Available models" },
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
  options: Omit<InteractiveSubjectOptions, "onTierFilter"> = {},
) {
  const user = userEvent.setup();

  const view = render(
    createElement(
      KeyboardProvider,
      null,
      createElement(TestInteractiveModelDialogKeyboard, { onTierFilter, ...options }),
    ),
  );

  const rerenderSubject = (nextOptions: Omit<InteractiveSubjectOptions, "onTierFilter">) => {
    view.rerender(
      createElement(
        KeyboardProvider,
        null,
        createElement(TestInteractiveModelDialogKeyboard, { onTierFilter, ...nextOptions }),
      ),
    );
  };

  return { user, onTierFilter, rerenderSubject };
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

  it("skips the disabled tier filters and lands on cancel when discovery failed", async () => {
    const { user } = renderInteractiveSubject(vi.fn(), { models: [] });

    await user.keyboard("/");
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: "all" })).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("keeps focus out of the disabled tier filters when leaving the footer upward", async () => {
    const { user } = renderInteractiveSubject(vi.fn(), { models: [] });

    const cancel = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancel);
    expect(cancel).toHaveFocus();

    await user.keyboard("{ArrowUp}");

    expect(screen.getByRole("radio", { name: "all" })).not.toHaveFocus();
    expect(screen.getByRole("textbox", { name: /search models/i })).toHaveFocus();
  });

  it("stops on Retry between search and the footer with ArrowDown when the discovery warning is shown", async () => {
    const { user } = renderInteractiveSubject(vi.fn(), { models: [], retryVisible: true });

    await user.keyboard("/");
    await user.keyboard("{ArrowDown}");

    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("reaches Retry when leaving the footer upward and returns to search with ArrowUp", async () => {
    const { user } = renderInteractiveSubject(vi.fn(), { models: [], retryVisible: true });

    const cancel = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancel);
    expect(cancel).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("textbox", { name: /search models/i })).toHaveFocus();
  });

  it("moves through the Retry stop with j and k exactly like the arrow keys", async () => {
    const { user } = renderInteractiveSubject(vi.fn(), { models: [], retryVisible: true });

    await user.keyboard("/");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();

    await user.keyboard("k");
    expect(screen.getByRole("textbox", { name: /search models/i })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("j");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("triggers retry with Enter and Space on the focused Retry button", async () => {
    const onRetry = vi.fn();
    const { user } = renderInteractiveSubject(vi.fn(), {
      models: [],
      retryVisible: true,
      onRetry,
    });

    await user.keyboard("/");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onRetry).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(onRetry).toHaveBeenCalledTimes(2);
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

  it("restores native search focus during open to the current model", async () => {
    renderInteractiveSubject(vi.fn(), {
      currentModel: "model-b",
      focusSearchDuringOpen: true,
    });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "model-b" })).toHaveFocus();
    });
    expect(screen.getByRole("textbox", { name: /search models/i })).not.toHaveFocus();
  });

  it("moves the focused model row with j and k", async () => {
    const { user } = renderInteractiveSubject(vi.fn(), { currentModel: "model-a" });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "model-a" })).toHaveFocus();
    });

    await user.keyboard("j");
    expect(screen.getByRole("radio", { name: "model-b" })).toHaveFocus();

    await user.keyboard("k");
    expect(screen.getByRole("radio", { name: "model-a" })).toHaveFocus();
  });

  it("jumps across the model list with Home and End", async () => {
    const models = [makeModel("model-a"), makeModel("model-b"), makeModel("model-c")];
    const { user } = renderInteractiveSubject(vi.fn(), { models, currentModel: "model-b" });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "model-b" })).toHaveFocus();
    });

    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "model-c" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "model-a" })).toHaveFocus();
  });

  it("types j and k into the search field instead of moving the list", async () => {
    const { user } = renderInteractiveSubject(vi.fn(), { currentModel: "model-a" });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "model-a" })).toHaveFocus();
    });

    await user.keyboard("/");
    const search = screen.getByRole("textbox", { name: /search models/i });
    expect(search).toHaveFocus();

    await user.keyboard("jk");
    expect(search).toHaveValue("jk");
    expect(search).toHaveFocus();
  });

  it("focuses the current model once models arrive even when footer autofocus landed during loading", async () => {
    const { user, rerenderSubject } = renderInteractiveSubject(vi.fn(), {
      currentModel: "model-a",
      models: [],
      discoveryStatus: "loading",
    });

    // Native <dialog> autofocus during the loading window: [Cancel] takes DOM
    // focus before any model row exists.
    const cancel = screen.getByRole("button", { name: "Cancel" });
    act(() => cancel.focus());
    expect(cancel).toHaveFocus();

    rerenderSubject({
      currentModel: "model-a",
      models: DEFAULT_INTERACTIVE_MODELS,
      discoveryStatus: "passed",
    });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "model-a" })).toHaveFocus();
    });

    // The list zone is live: j moves to the next row.
    await user.keyboard("j");
    expect(screen.getByRole("radio", { name: "model-b" })).toHaveFocus();
  });

  it("keeps a Navigate boundary during the loading window from stranding focus in the filter row", async () => {
    let keyboard: ReturnType<typeof useModelDialogKeyboard> | null = null;
    const captureKeyboard = (kb: ReturnType<typeof useModelDialogKeyboard>) => {
      keyboard = kb;
    };
    const { user, rerenderSubject } = renderInteractiveSubject(vi.fn(), {
      currentModel: "model-a",
      models: [],
      discoveryStatus: "loading",
      captureKeyboard,
    });

    // Native <dialog> autofocus during the loading window: [Cancel] takes DOM
    // focus before any model row exists.
    const cancel = screen.getByRole("button", { name: "Cancel" });
    act(() => cancel.focus());
    expect(cancel).toHaveFocus();

    // A Navigate keypress consumed by the list boundary while the initial-focus
    // window is still open (the models-arrival race) must not leave the list.
    act(() => keyboard?.handleListBoundaryReached("previous"));

    rerenderSubject({
      currentModel: "model-a",
      models: DEFAULT_INTERACTIVE_MODELS,
      discoveryStatus: "passed",
      captureKeyboard,
    });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "model-a" })).toHaveFocus();
    });
    expect(screen.getByRole("radio", { name: "all" })).not.toHaveFocus();

    // The list zone survived the loading-window boundary: j moves to the next row.
    await user.keyboard("j");
    expect(screen.getByRole("radio", { name: "model-b" })).toHaveFocus();
  });

  it("moves out of the tier-filter row with j and k exactly like the arrow keys", async () => {
    const { user } = renderInteractiveSubject(vi.fn(), { currentModel: "model-a" });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "model-a" })).toHaveFocus();
    });

    await user.keyboard("/");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "all" })).toHaveFocus();

    await user.keyboard("k");
    expect(screen.getByRole("textbox", { name: /search models/i })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "all" })).toHaveFocus();

    await user.keyboard("j");
    expect(screen.getByRole("radio", { name: "model-a" })).toHaveFocus();
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
