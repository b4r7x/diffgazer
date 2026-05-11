import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefCallback, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey, useFocusZone } from "@diffgazer/keys";
import { PROVIDER_FILTERS, type ProviderFilter } from "@/features/providers/constants";
import type { AIProvider } from "@diffgazer/core/schemas/config";

const PROVIDER_ZONES = ["input", "filters", "list", "buttons"] as const;

type FocusZone = typeof PROVIDER_ZONES[number];

interface ProvidersKeyboardOptions {
  selectedProvider: { id: AIProvider; hasApiKey: boolean; model?: string; name: string } | null;
  filteredProviders: Array<{ id: string }>;
  listReady: boolean;
  filter: ProviderFilter;
  setSelectedId: (id: string) => void;
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
  const [buttonIndex, setButtonIndex] = useState(0);
  const buttonRefs = useRef(new Map<number, HTMLButtonElement>());
  const filterButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const hasFocusedInitialProviderListRef = useRef(false);

  const { zone: internalZone, setZone, isZone } = useFocusZone({
    initial: "list",
    zones: PROVIDER_ZONES,
    scope: "providers",
    enabled: !dialogOpen,
  });

  const effectiveFocusZone = (!selectedProvider && internalZone === "buttons") ? "list" : internalZone;

  const canRemoveKey = selectedProvider?.hasApiKey ?? false;
  const needsModel = selectedProvider !== null && !selectedProvider.model;

  const getNextButtonIndex = (current: number, direction: 1 | -1) => {
    const enabled = [!needsModel, true, canRemoveKey, true];
    let next = current + direction;
    while (next >= 0 && next < 4) {
      if (enabled[next]) return next;
      next += direction;
    }
    return current;
  };

  const focusBoundaryProvider = (target: "first") => {
    const targetId = target === "first" ? filteredProviders[0]?.id : undefined;
    if (targetId) setSelectedId(targetId);
  };

  const focusProviderList = () => {
    listContainerRef.current?.focus();
  };

  const focusActionButton = (index: number) => {
    setButtonIndex(index);
    buttonRefs.current.get(index)?.focus();
  };

  const focusFirstActionButton = () => {
    if (!selectedProvider) return;
    setZone("buttons");
    focusActionButton(getNextButtonIndex(-1, 1));
  };

  const focusFilterButton = (index: number) => {
    const nextIndex = Math.max(0, Math.min(PROVIDER_FILTERS.length - 1, index));
    setZone("filters");
    setFilterIndex(nextIndex);
    filterButtonRefs.current.get(nextIndex)?.focus();
  };

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

  const handleButtonAction = (index: number) => {
    if (!selectedProvider) return;
    switch (index) {
      case 0: if (!needsModel) void onSelectProvider(selectedProvider.id, selectedProvider.name, selectedProvider.model); break;
      case 1: onSetApiKey(); break;
      case 2: if (selectedProvider.hasApiKey) void onRemoveKey(selectedProvider.id); break;
      case 3: onSelectModel(); break;
    }
  };

  const inInput = effectiveFocusZone === "input";
  const inFilters = effectiveFocusZone === "filters";
  const inButtons = effectiveFocusZone === "buttons";

  useEffect(() => {
    if (dialogOpen || !listReady || hasFocusedInitialProviderListRef.current) return;
    const listContainer = listContainerRef.current;
    if (!listContainer) return;
    const activeElement = listContainer.ownerDocument.activeElement;
    const View = listContainer.ownerDocument.defaultView;
    if (
      View &&
      activeElement instanceof View.HTMLElement &&
      activeElement !== listContainer.ownerDocument.body &&
      (
        activeElement.matches("input, textarea, select") ||
        activeElement.isContentEditable
      )
    ) {
      return;
    }

    setZone("list");
    listContainer.focus();
    hasFocusedInitialProviderListRef.current = true;
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
      focusBoundaryProvider("first");
      focusProviderList();
    }
  }, { enabled: !dialogOpen && inFilters, preventDefault: true });

  useKey("ArrowRight", () => {
    focusFirstActionButton();
  }, { enabled: !dialogOpen && isZone("list") && !!selectedProvider });

  useKey("ArrowLeft", () => {
    const next = getNextButtonIndex(buttonIndex, -1);
    if (next === buttonIndex) {
      setZone("list");
      focusProviderList();
    } else {
      focusActionButton(next);
    }
  }, { enabled: !dialogOpen && inButtons });
  useKey("ArrowRight", () => focusActionButton(getNextButtonIndex(buttonIndex, 1)),
    { enabled: !dialogOpen && inButtons });
  useKey("ArrowUp", () => focusActionButton(getNextButtonIndex(buttonIndex, -1)),
    { enabled: !dialogOpen && inButtons });
  useKey("ArrowDown", () => focusActionButton(getNextButtonIndex(buttonIndex, 1)),
    { enabled: !dialogOpen && inButtons });
  useKey("Enter", () => handleButtonAction(buttonIndex),
    { enabled: !dialogOpen && inButtons, preventDefault: true });
  useKey(" ", () => handleButtonAction(buttonIndex),
    { enabled: !dialogOpen && inButtons, preventDefault: true });

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
      focusBoundaryProvider("first");
      focusProviderList();
    }
  };

  const handleListKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== " ") return;
    event.preventDefault();
    focusFirstActionButton();
  };

  const getActionButtonProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => {
      if (node) buttonRefs.current.set(index, node);
      else buttonRefs.current.delete(index);
    },
    onFocus: () => {
      setZone("buttons");
      setButtonIndex(index);
    },
  });

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

  return {
    focusZone: effectiveFocusZone,
    filterIndex,
    setFilterIndex,
    buttonIndex,
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
