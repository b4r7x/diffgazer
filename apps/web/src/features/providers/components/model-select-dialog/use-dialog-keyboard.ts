import { TIER_FILTERS } from "@diffgazer/core/providers";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import {
  containsActiveElement,
  findNavigationItemByValue,
  useActionRowNavigation,
  useKey,
  useScopedNavigation,
} from "@diffgazer/keys";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefCallback,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useModelDialogZones } from "./use-dialog-zones";
import { useModelSearchFocus } from "./use-search-focus";
import { useSegmentedRowKeyboard } from "./use-segmented-row-keyboard";

type FocusZone = "close" | "search" | "filters" | "retry" | "list" | "footer";
type DiscoveryStatus = "idle" | "loading" | "passed" | "skipped" | "error";

interface ModelDialogKeyboardOptions {
  open: boolean;
  isSaving?: boolean;
  currentModel: string | undefined;
  models: ModelInfo[];
  filteredModels: ModelInfo[];
  discoveryStatus: DiscoveryStatus;
  /** Whether the discovery-warning Retry button is rendered; it then joins vertical navigation between the filter row and the list. */
  retryVisible?: boolean;
  /** The billing-pool group of the filter row, absent on a product whose endpoints are not pools. */
  pool?: {
    /** How many pools the product offers. */
    count: number;
    /** Moves the active pool tab to the next one. */
    cycle: () => void;
    /** Returns the active pool tab to the bound one when the dialog opens. */
    reset: () => void;
  };
  cycleTierFilter: () => void;
  resetFilters: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  listContainerRef: RefObject<HTMLDivElement | null>;
  onSelect: (modelId: string) => void;
  onOpenChange: (open: boolean) => void;
}

interface ModelDialogKeyboardReturn {
  focusZone: FocusZone;
  focusedModelId: string | null;
  checkedModelId: string | undefined;
  /** The focused segment of the filter row, counted across both groups. */
  headerIndex: number;
  footerButtonIndex: number;
  getFooterButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  getFilterButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  getPoolButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  getRetryButtonProps: () => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  getCloseButtonProps: () => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  handleHeaderKeyDown: (event: ReactKeyboardEvent) => void;
  handleConfirm: (modelId?: string) => void;
  handleSearchFocus: () => void;
  handleSearchArrowDown: () => void;
  handleListHighlightChange: (modelId: string | null) => void;
  handleListBoundaryReached: (direction: "previous" | "next") => void;
  handleListSelect: (modelId: string) => void;
}

function getModelFocusTargetId({
  filteredModels,
  focusedModelId,
  currentModel,
}: {
  filteredModels: ModelInfo[];
  focusedModelId: string | null;
  currentModel: string | undefined;
}): string | undefined {
  return [focusedModelId, currentModel, filteredModels[0]?.id].find(
    (id): id is string => id != null && filteredModels.some((model) => model.id === id),
  );
}

export function useModelDialogKeyboard({
  open,
  isSaving = false,
  currentModel,
  models,
  filteredModels,
  discoveryStatus,
  retryVisible = false,
  pool,
  cycleTierFilter,
  resetFilters,
  searchInputRef,
  listContainerRef,
  onSelect,
  onOpenChange,
}: ModelDialogKeyboardOptions): ModelDialogKeyboardReturn {
  const [checkedModelId, setCheckedModelId] = useState<string | undefined>(currentModel);
  const [headerIndex, setHeaderIndex] = useState(0);
  const hasHandledInitialFocusRef = useRef(false);
  const hadFilteredModelsRef = useRef(false);
  const headerButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  const listInteractive = !isSaving && discoveryStatus === "passed" && filteredModels.length > 0;
  const canConfirm = listInteractive;
  // The filter row is disabled unless discovery passed and the search box is
  // disabled while discovery is still running; navigation must skip whichever
  // zone cannot take focus, or the browser drops focus to document.body.
  const filtersInteractive = !isSaving && discoveryStatus === "passed";
  // The pool group exists only on a product whose endpoints are billing pools,
  // and it follows the rest of the row's enabled window.
  const poolCount = pool?.count ?? 0;
  const poolInteractive = poolCount > 0 && filtersInteractive;
  // The pool group leads the row, so the tier segments start after it.
  const headerCount = poolCount + TIER_FILTERS.length;
  const searchInteractive =
    !isSaving && discoveryStatus !== "idle" && discoveryStatus !== "loading";

  const {
    focusZone,
    setFocusZone,
    isZone,
    focusCloseButton,
    focusSearchInput,
    getCloseButtonProps,
  } = useModelDialogZones({ open, searchInteractive, searchInputRef, hasHandledInitialFocusRef });

  const blurSearchInput = () => searchInputRef.current?.blur();

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleConfirm = (explicitModelId?: string) => {
    if (isSaving) return;
    const nextModelId =
      (explicitModelId != null && filteredModels.some((model) => model.id === explicitModelId)
        ? explicitModelId
        : undefined) ?? confirmModelId;
    if (!nextModelId) return;
    onSelect(nextModelId);
  };

  const footerActionRow = useActionRowNavigation({
    enabled: open && isZone("footer") && !isSaving,
    actionCount: 2,
    disabledActions: [isSaving, !canConfirm],
    onAction: (index) => {
      if (index === 0) handleCancel();
      else if (index === 1 && canConfirm) handleConfirm();
    },
    onNavigationBoundaryReached: (direction) => {
      if (direction !== "previous") return;
      if (filteredModels.length === 0) {
        focusZoneAboveList();
        return;
      }
      setFocusZone("list");
      focusBoundaryModel("last");
    },
    wrap: false,
    defaultZone: "actions",
    defaultIndex: 1,
  });

  const getFooterButtonProps = (index: number) => {
    const actionProps = footerActionRow.getActionProps(index);
    return {
      ref: actionProps.ref,
      onFocus: () => {
        // Native <dialog> autofocus can land here while models are still
        // loading; mirroring it would overwrite the "list" zone and disable
        // the initial-focus repair, so ignore focus until that settles.
        if (!hasHandledInitialFocusRef.current) return;
        setFocusZone("footer");
        actionProps.onFocus();
      },
    };
  };

  const enterFooter = (index: number) => {
    setFocusZone("footer");
    footerActionRow.enterActions(index);
  };

  // Header button ref management and focus logic is structurally similar to
  // providers/hooks/use-list-navigation but differs in the flat index spanning two
  // groups and in the downstream zone transitions, so it stays local rather than
  // being extracted into a shared helper. Suppressed until initial focus is
  // handled so open-time autofocus cannot flip the zone away from the list.
  const focusHeaderButton = (index: number) => {
    if (!hasHandledInitialFocusRef.current) return;
    const nextIndex = Math.min(Math.max(index, 0), headerCount - 1);
    setFocusZone("filters");
    setHeaderIndex(nextIndex);
    headerButtonRefs.current.get(nextIndex)?.focus();
  };

  const registerHeaderButton = (index: number, node: HTMLButtonElement | null) => {
    if (node) headerButtonRefs.current.set(index, node);
    else headerButtonRefs.current.delete(index);
  };

  // The discovery-warning Retry button sits between the filter row and the
  // list, so it is a vertical stop there whenever the callout renders.
  const focusRetryButton = () => {
    setFocusZone("retry");
    retryButtonRef.current?.focus();
  };

  const getRetryButtonProps = () => ({
    ref: (node: HTMLButtonElement | null) => {
      retryButtonRef.current = node;
    },
    onFocus: () => {
      if (!hasHandledInitialFocusRef.current) return;
      setFocusZone("retry");
    },
  });

  // The first enabled zone above the Retry stop, so leaving it upward always
  // lands on an element that can hold focus.
  const focusZoneAboveRetry = () => {
    if (filtersInteractive) {
      focusHeaderButton(headerIndex);
      return;
    }
    if (searchInteractive) {
      focusSearchInput();
      return;
    }
    focusCloseButton();
  };

  // The first enabled zone above the model list, so leaving the list or the
  // footer upward always lands on an element that can hold focus.
  const focusZoneAboveList = () => {
    if (retryVisible) {
      focusRetryButton();
      return;
    }
    focusZoneAboveRetry();
  };

  const handleListBoundaryReached = (direction: "previous" | "next") => {
    // A Navigate keypress can reach the boundary while the initial-focus
    // window is still open: the navigation handlers register when models
    // arrive, but the focus repair runs in a later effect, so with no row
    // focused yet the first j/k reads as a boundary hit. Leaving the list
    // then would strand the user in the filter row or footer before they
    // ever saw the list, so re-assert the list target instead.
    if (!hasHandledInitialFocusRef.current) {
      const targetId = getModelFocusTargetId({ filteredModels, focusedModelId, currentModel });
      if (targetId !== undefined && focusModelElement(targetId)) {
        hasHandledInitialFocusRef.current = true;
      }
      return;
    }
    if (direction === "previous") {
      focusHeaderButton(headerIndex);
      return;
    }
    enterFooter(1);
  };

  // listContainerRef is the scroll wrapper, so the rows' owning composite is
  // the nested RadioGroup, not the container; owner scoping would filter out
  // every row. There is exactly one radio list inside, so disable it.
  const { highlighted: focusedModelId, highlight: focusModel } = useScopedNavigation({
    containerRef: listContainerRef,
    role: "radio",
    ownerSelector: null,
    enabled: open && listInteractive && isZone("list"),
    wrap: false,
    moveFocus: true,
    upKeys: ["k"],
    downKeys: ["j"],
    onNavigationBoundaryReached: handleListBoundaryReached,
  });

  // The row Confirm posts. It resolves among the visible rows alone, so a pool
  // tab or a search that filters the checked row away can never make a confirm
  // save a model the user cannot see.
  const confirmModelId =
    [checkedModelId, focusedModelId].find(
      (id) => id != null && filteredModels.some((model) => model.id === id),
    ) ?? filteredModels[0]?.id;

  const getModelElement = (modelId: string) => {
    return findNavigationItemByValue(listContainerRef.current, {
      type: "radio",
      value: modelId,
      ownerSelector: null,
    });
  };

  const focusModelElement = (modelId: string) => {
    focusModel(modelId);
    const modelElement = getModelElement(modelId);
    if (!modelElement) return false;

    modelElement.focus();
    return containsActiveElement(modelElement);
  };

  const focusBoundaryModel = (target: "first" | "last") => {
    const targetId =
      target === "last" ? filteredModels[filteredModels.length - 1]?.id : filteredModels[0]?.id;
    if (targetId) focusModelElement(targetId);
  };

  const enterListFromBoundary = (target: "first" | "last") => {
    setFocusZone("list");
    focusBoundaryModel(target);
  };

  // Both groups share one row, so they share one zone, one flat index, and one
  // pair of vertical exits: the search box above, the list (or the footer, with
  // nothing to navigate) below.
  const headerRow = useSegmentedRowKeyboard({
    // Keys stay quiet during the save window: discoveryStatus is forced to
    // "passed" while saving, so f would otherwise still cycle the tier filter.
    inRow: open && !isSaving && isZone("filters"),
    groups: [
      // The search box keeps the letters for typing, so both accelerators stand
      // down while focus is inside it.
      ...(poolCount > 0
        ? [
            {
              accelerator: "p",
              acceleratorEnabled: open && poolInteractive && !isZone("search"),
              cycle: () => pool?.cycle(),
              count: poolCount,
            },
          ]
        : []),
      {
        accelerator: "f",
        acceleratorEnabled: open && !isSaving && !isZone("search") && discoveryStatus === "passed",
        cycle: cycleTierFilter,
        count: TIER_FILTERS.length,
      },
    ],
    focusedIndex: headerIndex,
    focusZoneAbove: focusSearchInput,
    focusZoneBelow: () => {
      if (!listInteractive) {
        enterFooter(0);
        return;
      }
      enterListFromBoundary("first");
    },
    registerButton: registerHeaderButton,
    focusAtIndex: focusHeaderButton,
  });

  const focusZoneBelowSearch = () => {
    if (filtersInteractive) {
      focusHeaderButton(headerIndex);
      return;
    }
    if (retryVisible) {
      focusRetryButton();
      return;
    }
    if (listInteractive) {
      enterListFromBoundary("first");
      return;
    }
    enterFooter(0);
  };

  // The footer teaches arrows only, but j/k stays the vim alias the shared
  // Help table promises, so j/k must move through the Retry stop exactly like
  // the arrow keys. Enter/Space activate the focused native button, so no
  // binding is needed for them.
  useKey(["ArrowUp", "k"], focusZoneAboveRetry, {
    enabled: open && retryVisible && isZone("retry"),
    preventDefault: true,
  });
  // A visible Retry callout always means an empty, non-interactive list, so the
  // footer is the only stop below it.
  useKey(["ArrowDown", "j"], () => enterFooter(0), {
    enabled: open && retryVisible && isZone("retry"),
    preventDefault: true,
  });

  const search = useModelSearchFocus({
    // Quiet during the save window: / would flip the zone to search while the
    // disabled input cannot take focus, stranding the post-save repair.
    open: open && !isSaving,
    inSearch: isZone("search"),
    blurSearchInput,
    focusSearchInput,
    focusCloseButton,
    focusZoneBelowSearch,
  });

  const resetDialogState = useEffectEvent(() => {
    hasHandledInitialFocusRef.current = false;
    hadFilteredModelsRef.current = false;
    resetFilters();
    pool?.reset();
    setFocusZone("list");
    // The pool tab resets to the bound pool, which leads the row, so the row's
    // focus starts on its first segment whichever groups render.
    setHeaderIndex(0);
    setCheckedModelId(currentModel);
    const targetId = currentModel ?? models[0]?.id;
    // Only a focus that actually landed in the list closes the initial-focus
    // window; while it stays open, the zone mirrors ignore open-time autofocus
    // and the effect below finishes the job when models arrive.
    if (targetId && focusModelElement(targetId)) {
      hasHandledInitialFocusRef.current = true;
    }
  });

  const repairListFocus = useEffectEvent(() => {
    const targetId = getModelFocusTargetId({
      filteredModels,
      focusedModelId,
      currentModel,
    });
    const container = listContainerRef.current;
    // Focus parked on the container itself (the saving window) is not settled
    // list focus; only a focused row suppresses the repair, so a failed save
    // hands focus back to the model row.
    const listHasFocus = container
      ? containsActiveElement(container) && container.ownerDocument.activeElement !== container
      : false;
    if (targetId === focusedModelId && listHasFocus) {
      hasHandledInitialFocusRef.current = true;
      return;
    }

    if (targetId !== undefined && focusModelElement(targetId)) {
      hasHandledInitialFocusRef.current = true;
    }
  });

  const moveEmptyListFocusToCancel = useEffectEvent(() => {
    enterFooter(0);
  });

  // The save window keeps the model rows on screen but disables every dialog
  // control. A focused row keeps its DOM focus (aria-disabled rows stay
  // focusable), but focus that was on a now-disabled button drops to body, so
  // park it on the list container (tabIndex -1 while saving); when the dialog
  // closes instead, the unmount focus restore takes over.
  const parkSavingFocus = useEffectEvent(() => {
    const container = listContainerRef.current;
    if (!container || containsActiveElement(container)) return;
    setFocusZone("list");
    container.focus();
  });

  useEffect(() => {
    if (!open) {
      hasHandledInitialFocusRef.current = false;
      return;
    }
    resetDialogState();
  }, [open]);

  const filteredIdsKey = filteredModels.map((m) => m.id).join("\0");

  // biome-ignore lint/correctness/useExhaustiveDependencies: filteredIdsKey is the serialized form of filteredModels (ids joined); depending on the array identity would re-run this effect on every commit while the dialog is open, so the filteredModels read inside repairListFocus is covered by filteredIdsKey. isSaving parks focus when the save window opens and retries recovery with discoveryStatus when saving completes or discovery becomes ready.
  useEffect(() => {
    if (!open) return;
    if (!listInteractive) {
      if (isSaving) {
        parkSavingFocus();
        return;
      }
      if (!hasHandledInitialFocusRef.current) {
        // Keep the initial-focus window open while discovery can still deliver
        // models; once it settles without a focusable list, land on Cancel
        // instead of leaving native autofocus wherever it fell.
        if (discoveryStatus === "idle" || discoveryStatus === "loading") return;
        hasHandledInitialFocusRef.current = true;
        moveEmptyListFocusToCancel();
        return;
      }
      if (focusZone === "list" && hadFilteredModelsRef.current) {
        moveEmptyListFocusToCancel();
      }
      return;
    }
    hadFilteredModelsRef.current = true;
    // Until initial focus lands in the list, repair regardless of the current
    // zone: open-time autofocus during the loading window must not disable it.
    if (hasHandledInitialFocusRef.current && focusZone !== "list") return;
    repairListFocus();
  }, [open, focusZone, filteredIdsKey, isSaving, discoveryStatus]);

  const exitRemovedRetryZone = useEffectEvent(() => {
    if (!isZone("retry")) return;
    focusZoneAboveRetry();
  });

  // Activating Retry unmounts the callout while its button holds focus, which
  // would drop focus to the body with the zone stuck on "retry"; hand it to
  // the nearest zone above instead.
  useEffect(() => {
    if (!open || retryVisible) return;
    exitRemovedRetryZone();
  }, [open, retryVisible]);

  const handleListSelect = (modelId: string) => {
    setFocusZone("list");
    focusModelElement(modelId);
    setCheckedModelId(modelId);
  };

  // Browser-focus mirror for the search input, suppressed like the other zone
  // mirrors until the dialog's initial list focus has been handled.
  const handleSearchFocus = () => {
    if (!hasHandledInitialFocusRef.current) return;
    setFocusZone("search");
  };

  const handleListHighlightChange = (modelId: string | null) => {
    if (modelId === null) return;
    setFocusZone("list");
    focusModel(modelId);
  };

  return {
    focusZone,
    focusedModelId,
    checkedModelId,
    headerIndex,
    footerButtonIndex: footerActionRow.focusedIndex,
    getCloseButtonProps,
    getFooterButtonProps,
    // The pool group leads the row, so the tier segments sit behind its count.
    getFilterButtonProps: (index: number) => headerRow.getButtonProps(poolCount + index),
    getPoolButtonProps: headerRow.getButtonProps,
    getRetryButtonProps,
    handleHeaderKeyDown: headerRow.handleKeyDown,
    handleConfirm,
    handleSearchFocus,
    handleSearchArrowDown: search.handleSearchArrowDown,
    handleListHighlightChange,
    handleListBoundaryReached,
    handleListSelect,
  };
}
