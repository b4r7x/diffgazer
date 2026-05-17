import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefCallback, type RefObject } from "react";

import { useNavigate } from "@tanstack/react-router";
import { useActionRowNavigation, useFocusZone, useKey } from "@diffgazer/keys";
import { PROVIDER_FILTERS, type ProviderFilter } from "@diffgazer/core/providers";
import type { AIProvider } from "@diffgazer/core/schemas/config";

const PROVIDER_ZONES = ["input", "filters", "list", "buttons"] as const;
const BUTTON_COUNT = 4;

type FocusZone = typeof PROVIDER_ZONES[number];

interface ProvidersKeyboardOptions {
  selectedProvider: { id: AIProvider; hasApiKey: boolean; model?: string; name: string } | null;
  filteredProviders: Array<{ id: string }>;
  listReady: boolean;
  filter: ProviderFilter;
  setSelectedId: (id: string | null) => void;
  dialogOpen: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  listContainerRef: RefObject<HTMLDivElement | null>;
  onSetApiKey: () => void;
  onSelectModel: () => void;
  onRemoveKey: (id: AIProvider) => Promise<void>;
  onSelectProvider: (id: AIProvider, name: string, model: string | undefined) => Promise<void>;
}

interface ProvidersKeyboardReturn {
  focusZone: FocusZone;
  filterIndex: number;
  setFilterIndex: (index: number | ((prev: number) => number)) => void;
  buttonIndex: number;
  getActionButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  getFilterButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  handleFilterKeyDown: (event: ReactKeyboardEvent) => void;
  handleListKeyDown: (event: ReactKeyboardEvent) => void;
  handleSearchFocus: () => void;
  handleFilterFocus: (index: number) => void;
  handleListFocus: () => void;
  handleSearchEscape: () => void;
  handleListBoundary: (direction: "up" | "down") => void;
}

export function useProvidersKeyboard({
  selectedProvider,
  filteredProviders,
  listReady,
  filter,
  setSelectedId,
  dialogOpen,
  inputRef,
  listContainerRef,
  onSetApiKey,
  onSelectModel,
  onRemoveKey,
  onSelectProvider,
}: ProvidersKeyboardOptions): ProvidersKeyboardReturn {
  const navigate = useNavigate();
  const [filterIndex, setFilterIndex] = useState(0);
  const filterButtonRefs = useRef(new Map<number, HTMLButtonElement>());

  const { zone: internalZone, setZone, isZone } = useFocusZone({
    initial: "list",
    zones: PROVIDER_ZONES,
    scope: "providers",
    enabled: !dialogOpen,
  });

  const effectiveFocusZone = (!selectedProvider && internalZone === "buttons") ? "list" : internalZone;

  const canRemoveKey = selectedProvider?.hasApiKey ?? false;
  const needsModel = selectedProvider !== null && !selectedProvider.model;

  const handleButtonAction = (index: number) => {
    if (!selectedProvider) return;
    switch (index) {
      case 0: if (!needsModel) void onSelectProvider(selectedProvider.id, selectedProvider.name, selectedProvider.model); break;
      case 1: onSetApiKey(); break;
      case 2: if (selectedProvider.hasApiKey) void onRemoveKey(selectedProvider.id); break;
      case 3: onSelectModel(); break;
    }
  };

  const focusFirstProvider = () => {
    const firstProviderId = filteredProviders[0]?.id;
    if (firstProviderId) setSelectedId(firstProviderId);
  };

  const focusProviderList = () => {
    listContainerRef.current?.focus();
  };

  const focusFilterButton = (index: number) => {
    const nextIndex = Math.max(0, Math.min(PROVIDER_FILTERS.length - 1, index));
    setZone("filters");
    setFilterIndex(nextIndex);
    filterButtonRefs.current.get(nextIndex)?.focus();
  };

  const actionRow = useActionRowNavigation({
    enabled: !dialogOpen && effectiveFocusZone === "buttons",
    actionCount: BUTTON_COUNT,
    disabledActions: [needsModel, false, !canRemoveKey, false],
    onAction: handleButtonAction,
    onNavigationBoundaryReached: (direction) => {
      if (direction === "previous") {
        setZone("list");
        focusProviderList();
      }
    },
    wrap: false,
    defaultZone: "actions",
  });

  const enterButtons = (index: number = 0) => {
    if (!selectedProvider) return;
    setZone("buttons");
    actionRow.enterActions(index);
  };

  const getActionButtonProps = (index: number) => {
    const actionProps = actionRow.getActionProps(index);
    return {
      ref: actionProps.ref,
      onFocus: () => {
        setZone("buttons");
        actionProps.onFocus();
      },
    };
  };

  const getFilterButtonProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => {
      if (node) filterButtonRefs.current.set(index, node);
      else filterButtonRefs.current.delete(index);
    },
    onFocus: () => {
      setZone("filters");
      setFilterIndex(index);
    },
  });

  const handleSearchFocus = () => {
    setZone("input");
  };

  const handleFilterFocus = (index: number) => {
    setZone("filters");
    setFilterIndex(index);
  };

  const handleListFocus = () => {
    setZone("list");
  };

  const handleSearchEscape = () => {
    focusFilterButton(PROVIDER_FILTERS.indexOf(filter));
    inputRef.current?.blur();
  };

  const inInput = effectiveFocusZone === "input";
  const inFilters = effectiveFocusZone === "filters";

  useEffect(() => {
    if (dialogOpen || !listReady) return;
    const listContainer = listContainerRef.current;
    if (!listContainer) return;
    const ownerDocument = listContainer.ownerDocument;
    const activeElement = ownerDocument.activeElement;
    const View = ownerDocument.defaultView;
    const focusIsUnclaimed = activeElement === ownerDocument.body || activeElement === ownerDocument.documentElement;
    const focusIsWithinList = Boolean(View && activeElement instanceof View.Node && listContainer.contains(activeElement));
    if (!focusIsUnclaimed && !focusIsWithinList) return;

    setZone("list");
    listContainer.focus();
  }, [dialogOpen, listReady, listContainerRef, setZone]);

  useKey("ArrowDown", () => {
    focusFilterButton(PROVIDER_FILTERS.indexOf(filter));
    inputRef.current?.blur();
  }, { enabled: !dialogOpen && inInput, allowInInput: true, preventDefault: true });
  useKey("Escape", handleSearchEscape, { enabled: !dialogOpen && inInput, allowInInput: true });

  useKey("ArrowUp", () => {
    setZone("input");
    inputRef.current?.focus();
  }, { enabled: !dialogOpen && inFilters, preventDefault: true });
  useKey("ArrowDown", () => {
    if (filteredProviders.length > 0) {
      setZone("list");
      focusFirstProvider();
      focusProviderList();
    }
  }, { enabled: !dialogOpen && inFilters, preventDefault: true });

  useKey("ArrowRight", () => {
    enterButtons(0);
  }, { enabled: !dialogOpen && isZone("list") && selectedProvider !== null });

  const inButtons = effectiveFocusZone === "buttons";
  const navigateButtonsVertical = (direction: 1 | -1) => {
    const enabledFlags = [!needsModel, true, canRemoveKey, true];
    let next = actionRow.focusedIndex + direction;
    while (next >= 0 && next < BUTTON_COUNT) {
      if (enabledFlags[next]) {
        actionRow.enterActions(next);
        return;
      }
      next += direction;
    }
  };
  useKey("ArrowUp", () => navigateButtonsVertical(-1),
    { enabled: !dialogOpen && inButtons });
  useKey("ArrowDown", () => navigateButtonsVertical(1),
    { enabled: !dialogOpen && inButtons });

  useKey("Escape", () => navigate({ to: "/settings" }), { enabled: !dialogOpen && !inInput });
  useKey("/", () => {
    setZone("input");
    inputRef.current?.focus();
  }, { enabled: !dialogOpen && !inInput, preventDefault: true });

  const handleListBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      focusFilterButton(PROVIDER_FILTERS.indexOf(filter));
    }
  };

  const handleFilterKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setZone("input");
      inputRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filteredProviders.length === 0) return;
      setZone("list");
      focusFirstProvider();
      focusProviderList();
    }
  };

  const handleListKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== " ") return;
    event.preventDefault();
    enterButtons(0);
  };

  return {
    focusZone: effectiveFocusZone,
    filterIndex,
    setFilterIndex,
    buttonIndex: actionRow.focusedIndex,
    getActionButtonProps,
    getFilterButtonProps,
    handleFilterKeyDown,
    handleListKeyDown,
    handleSearchFocus,
    handleFilterFocus,
    handleListFocus,
    handleSearchEscape,
    handleListBoundary,
  };
}
