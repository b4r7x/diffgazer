import type { KeyboardEvent as ReactKeyboardEvent, RefCallback, RefObject } from "react";

import { useNavigate } from "@tanstack/react-router";
import { useFocusZone, useKey } from "@diffgazer/keys";
import type { ProviderFilter } from "@diffgazer/core/providers";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { useProvidersActionButtons } from "./use-providers-action-buttons";
import { useProvidersListNavigation } from "./use-providers-list-navigation";
import { useProvidersDialogKeyboard } from "./use-providers-dialog-keyboard";

const PROVIDER_ZONES = ["input", "filters", "list", "buttons"] as const;

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

  const { zone: internalZone, setZone, isZone } = useFocusZone({
    initial: "list",
    zones: PROVIDER_ZONES,
    scope: "providers",
    enabled: !dialogOpen,
  });

  const effectiveFocusZone = (!selectedProvider && internalZone === "buttons") ? "list" : internalZone;
  const inInput = effectiveFocusZone === "input";
  const inFilters = effectiveFocusZone === "filters";
  const inButtons = effectiveFocusZone === "buttons";

  const focusProviderList = () => {
    listContainerRef.current?.focus();
  };

  const { buttonIndex, enterButtons, getActionButtonProps } = useProvidersActionButtons({
    selectedProvider,
    dialogOpen,
    inButtons,
    setZone,
    focusProviderList,
    onSetApiKey,
    onSelectModel,
    onRemoveKey,
    onSelectProvider,
  });

  const list = useProvidersListNavigation({
    selectedProvider,
    filteredProviders,
    filter,
    dialogOpen,
    inInput,
    inFilters,
    inList: isZone("list"),
    inputRef,
    setZone,
    setSelectedId,
    focusProviderList,
    enterButtons,
  });

  useProvidersDialogKeyboard({
    dialogOpen,
    listReady,
    listContainerRef,
    setZone,
  });

  useKey("Escape", () => navigate({ to: "/settings" }), { enabled: !dialogOpen && !inInput });

  return {
    focusZone: effectiveFocusZone,
    filterIndex: list.filterIndex,
    setFilterIndex: list.setFilterIndex,
    buttonIndex,
    getActionButtonProps,
    getFilterButtonProps: list.getFilterButtonProps,
    handleFilterKeyDown: list.handleFilterKeyDown,
    handleListKeyDown: list.handleListKeyDown,
    handleSearchFocus: list.handleSearchFocus,
    handleFilterFocus: list.handleFilterFocus,
    handleListFocus: list.handleListFocus,
    handleSearchEscape: list.handleSearchEscape,
    handleListBoundary: list.handleListBoundary,
  };
}
